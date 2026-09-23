import prisma from '../../api/lib/prisma.js';
import { CATEGORIES, ensureAggregationEnqueued } from './queues.js';

// Wraps a category processor (complexity, deadcode, ...) with AnalysisRun bookkeeping and
// the handoff to aggregation. The five processors now only compute and return a report;
// every rule about run state lives here, in one place.
export function withRunTracking(category, processor) {
  return async (job) => {
    const { runId } = job.data;

    // Every job enqueued by fanOut has a runId. One without it predates AnalysisRun;
    // it's still analyzed, but nothing aggregates it (drain queues before deploying).
    if (!runId) {
      console.warn(`[${category}] job ${job.id} has no runId — result will not be aggregated`);
      return processor(job);
    }

    const run = await prisma.analysisRun.findUnique({ where: { id: runId }, select: { status: true } });

    // Only QUEUED/RUNNING runs still need category work. Anything else means this is a
    // duplicate or late delivery (retry, stalled-job redelivery, sweeper already acted).
    if (!run || !['QUEUED', 'RUNNING'].includes(run.status)) {
      // Cheap self-healing: if the run is waiting for aggregation, make sure that job exists
      // (the worker that advanced it may have crashed before enqueueing)
      if (run?.status === 'AGGREGATING') await ensureAggregationEnqueued(runId);
      console.log(`[run ${runId}] ${run ? run.status : 'not found'} — skipping ${category} job`);
      return { skipped: true };
    }

    // updateMany with a status condition, not update: only the FIRST of the five workers
    // flips QUEUED → RUNNING. The others match zero rows, which is a harmless no-op.
    await prisma.analysisRun.updateMany({
      where: { id: runId, status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    let report;
    try {
      report = await processor(job);
    } catch (err) {
      // THE "stuck forever" fix: before, a category that failed all its attempts left no
      // trace, so the run waited for it forever. Now its last attempt records FAILED, which
      // counts as "this category is finished" for the handoff below.
      if (isFinalAttempt(job)) {
        await recordCategoryOutcome(runId, category, { error: err.message })
          .catch(e => console.error(`[run ${runId}] could not record ${category} failure:`, e.message));
      }
      throw err;   // still fail the job, so BullMQ retries it / shows it as failed
    }

    await recordCategoryOutcome(runId, category, { report });
    return report;
  };
}

// Save one category's outcome, then try to hand the run off to aggregation.
// Order matters: the result is COMMITTED first, and only then do we look at the count.
export async function recordCategoryOutcome(runId, category, { report, error }) {
  // Results freeze once aggregation starts: a late or duplicate delivery must not change the
  // inputs of a snapshot that may already exist. (Small window between this read and the
  // write below; acceptable because every attempt analyzes the same commit.)
  const run = await prisma.analysisRun.findUnique({ where: { id: runId }, select: { status: true } });
  if (run?.status !== 'RUNNING') return false;

  if (error === undefined) {
    const json = JSON.parse(JSON.stringify(report));   // drop undefined fields for Prisma's Json type
    // Success overwrites: a retried or duplicate job replaces its own row (unique runId+category)
    await prisma.categoryResult.upsert({
      where: { runId_category: { runId, category } },
      create: { runId, category, status: 'SUCCEEDED', report: json },
      update: { status: 'SUCCEEDED', report: json, error: null },
    });
  } else {
    // Failure never overwrites (INSERT ... ON CONFLICT DO NOTHING): if another delivery of the
    // same job already succeeded, or the sweeper races a job that just finished, success wins.
    await prisma.categoryResult.createMany({
      data: [{ runId, category, status: 'FAILED', error: String(error).slice(0, 1000) }],
      skipDuplicates: true,
    });
  }
  return advanceToAggregating(runId);
}

// The handoff. ONE statement that only succeeds if the run is still RUNNING *and* all five
// categories have a row (SUCCEEDED or FAILED). Two properties make it safe:
//  - It runs after our own result is committed. Whichever worker commits LAST therefore
//    sees all five rows, so the run can't be left un-advanced (no "everyone saw 4 of 5").
//  - If two workers both see 5, Postgres locks the row for the first UPDATE; the second
//    re-checks `status = 'RUNNING'` after the lock, finds AGGREGATING, and updates 0 rows.
// So exactly one caller gets 1 back, and only that caller enqueues aggregation.
export async function advanceToAggregating(runId) {
  const advanced = await prisma.$executeRaw`
    UPDATE "AnalysisRun"
    SET status = 'AGGREGATING', "updatedAt" = ${new Date()}
    WHERE id = ${runId}
      AND status = 'RUNNING'
      AND (SELECT COUNT(*) FROM "CategoryResult" WHERE "runId" = ${runId}) = ${CATEGORIES.length}
  `;
  // If we crash right here (advanced, not enqueued), the run sits in AGGREGATING with no job.
  // That window is exactly what the sweeper covers.
  if (advanced === 1) await ensureAggregationEnqueued(runId);
  return advanced === 1;
}

// Terminal transitions used by the aggregator. Conditional for the same reason:
// never overwrite a run that some other path already finished.
export async function markRunSucceeded(runId) {
  if (!runId) return;
  await prisma.analysisRun.updateMany({
    where: { id: runId, status: { in: ['RUNNING', 'AGGREGATING'] } },
    data: { status: 'SUCCEEDED', finishedAt: new Date() },
  });
}

export async function markRunFailed(runId, error) {
  if (!runId) return;
  await prisma.analysisRun.updateMany({
    where: { id: runId, status: { notIn: ['SUCCEEDED', 'PARTIAL', 'FAILED'] } },
    data: { status: 'FAILED', error: String(error).slice(0, 1000), finishedAt: new Date() },
  });
}

// BullMQ's attemptsMade counts attempts that already FAILED, so the attempt now running
// is attemptsMade + 1. Used so only the LAST attempt records a permanent failure.
export function isFinalAttempt(job) {
  return job.attemptsMade + 1 >= (job.opts?.attempts ?? 1);
}

// The aggregator's input: { complexity: {status, report, error}, ... } read from Postgres.
export async function loadCategoryResults(runId) {
  const rows = await prisma.categoryResult.findMany({ where: { runId } });
  return Object.fromEntries(rows.map(r => [r.category, r]));
}

// At-most-once guard for the PR comment. The claim is written BEFORE posting, and only one
// caller can move prCommentClaimedAt from NULL to a timestamp. Trade-off: if posting fails
// after the claim, the comment is never posted — a missing comment beats duplicate spam.
export async function claimPrComment(runId) {
  const { count } = await prisma.analysisRun.updateMany({
    where: { id: runId, prCommentClaimedAt: null },
    data: { prCommentClaimedAt: new Date() },
  });
  return count === 1;
}

// One snapshot per run, safe under concurrent aggregations.
// Why the odd `update: { commitSha }` (a run's commitSha never changes, so it's a no-op):
// Prisma only emits a single atomic `INSERT ... ON CONFLICT ("runId") DO UPDATE` when the
// update clause is non-empty. With `update: {}` it falls back to SELECT-then-INSERT, and two
// simultaneous aggregations can both see "no row" — the loser fails with P2002.
// Only the first aggregation's numbers are kept; later ones read the same CategoryResults anyway.
export async function upsertRunSnapshot(runId, data) {
  return prisma.snapshot.upsert({
    where: { runId },
    create: { ...data, runId },
    update: { commitSha: data.commitSha },
  });
}

import prisma from '../../api/lib/prisma.js';

// Wraps a category processor (complexity, deadcode, ...) with AnalysisRun bookkeeping.
// Done as one wrapper in worker/index.js rather than edits inside all five workers,
// so the lifecycle rules live in one place (Step 3 extends this for final-attempt failures).
export function withRunTracking(processor) {
  return async (job) => {
    const { runId } = job.data;

    // Jobs enqueued before AnalysisRun existed have no runId — process them the old way
    if (!runId) return processor(job);

    const run = await prisma.analysisRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });

    // FAILED here means fan-out broke part-way (see api/services/queue.js); the run is
    // already over, so doing the work would only produce results nobody reads.
    // A missing row means the repo (and its runs, via cascade) was deleted.
    if (!run || run.status === 'FAILED') {
      console.log(`[run ${runId}] ${run ? 'already FAILED' : 'not found'} — skipping ${job.queueName} job`);
      return { skipped: true };
    }

    // updateMany with a status condition, not update: only the FIRST of the five workers
    // flips QUEUED → RUNNING. The others match zero rows, which is a harmless no-op,
    // and a retried job can't drag a finished run back to RUNNING.
    await prisma.analysisRun.updateMany({
      where: { id: runId, status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    return processor(job);
  };
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

// Upsert on the (runId, category) unique rule: a retried or re-delivered category job
// overwrites its own row instead of adding a second one. "Last write wins" is safe here
// because every attempt analyzes the same commit.
export async function saveCategoryResult(runId, category, report) {
  // Round-trip through JSON so undefined fields / Dates become plain JSON Prisma accepts
  const json = JSON.parse(JSON.stringify(report));
  await prisma.categoryResult.upsert({
    where: { runId_category: { runId, category } },
    create: { runId, category, status: 'SUCCEEDED', report: json },
    update: { status: 'SUCCEEDED', report: json, error: null },
  });
}

// The aggregator's input: { complexity: report, deadcode: report, ... } read from Postgres.
export async function loadCategoryResults(runId) {
  const rows = await prisma.categoryResult.findMany({ where: { runId } });
  return Object.fromEntries(rows.map(r => [r.category, r.report]));
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

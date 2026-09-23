import prisma from '../../api/lib/prisma.js';
import { CATEGORIES, categoryQueue, aggregatorQueue, ensureAggregationEnqueued } from './queues.js';
import { recordCategoryOutcome, advanceToAggregating, markRunFailed } from './runLifecycle.js';

// The safety net. The normal path (runLifecycle.js) handles every failure that raises an
// exception; the sweeper handles the ones that don't: a process killed mid-step, a job
// dropped from Redis, a job that hangs forever. Every action it takes is idempotent, so
// running it on several worker processes at once is harmless.
export const DEFAULT_LIMITS = {
  aggregatingStaleMs: 2 * 60_000,   // AGGREGATING this long → make sure the aggregation job exists
  runningCheckMs:     2 * 60_000,   // RUNNING this long → look at the BullMQ state of missing categories
  runningTimeoutMs:  60 * 60_000,   // RUNNING this long → give up on categories still pending
  queuedStaleMs:     10 * 60_000,   // QUEUED this long with no jobs at all → fail the run
};
const BATCH = 50;   // bound the work per sweep

// BullMQ states in which a job will never produce a result on its own. ('completed' without
// a CategoryResult shouldn't happen — the result is saved before the job completes — but if
// it does, waiting won't fix it.)
const DEAD_STATES = ['missing', 'failed', 'completed', 'unknown'];

async function jobState(queue, runId) {
  const job = await queue.getJob(runId);
  return job ? { state: await job.getState(), reason: job.failedReason } : { state: 'missing' };
}

export async function sweepStuckRuns({ now = new Date(), limits = DEFAULT_LIMITS } = {}) {
  const ago = ms => new Date(now.getTime() - ms);
  const summary = { aggregationEnsured: 0, aggregationFailed: 0, categoriesFailed: 0, advanced: 0, queuedFailed: 0 };

  // 1. AGGREGATING too long: the worker that advanced the run may have died before
  //    enqueueing, or the aggregation job died in a way that never reached its catch block.
  const aggregating = await prisma.analysisRun.findMany({
    where: { status: 'AGGREGATING', updatedAt: { lt: ago(limits.aggregatingStaleMs) } },
    select: { id: true }, take: BATCH,
  });
  for (const { id } of aggregating) {
    const { state, reason } = await jobState(aggregatorQueue(), id);
    if (state === 'failed') {
      // e.g. worker crashed during the final attempt ("job stalled more than allowable limit"):
      // re-adding the same jobId would be ignored, so end the run instead of waiting forever
      await markRunFailed(id, `aggregation failed: ${reason ?? 'unknown'}`);
      summary.aggregationFailed++;
    } else if (state === 'missing') {
      await ensureAggregationEnqueued(id);
      summary.aggregationEnsured++;
    }
    // waiting / delayed / active: it's on its way — leave it alone
  }

  // 2. RUNNING too long: find categories with no result whose job can no longer deliver one
  const running = await prisma.analysisRun.findMany({
    where: { status: 'RUNNING', startedAt: { lt: ago(limits.runningCheckMs) } },
    select: { id: true, startedAt: true, categoryResults: { select: { category: true } } },
    take: BATCH,
  });
  for (const run of running) {
    const done = new Set(run.categoryResults.map(r => r.category));
    const timedOut = run.startedAt < ago(limits.runningTimeoutMs);
    for (const category of CATEGORIES.filter(c => !done.has(c))) {
      const { state, reason } = await jobState(categoryQueue(category), run.id);
      let error = null;
      if (DEAD_STATES.includes(state)) error = `${category} job ${state}${reason ? `: ${reason}` : ''} without recording a result`;
      else if (timedOut) error = `${category} timed out after ${limits.runningTimeoutMs / 60_000} min (job ${state})`;
      if (error) {
        // Recorded as FAILED with ON CONFLICT DO NOTHING — if the job finished a moment ago,
        // its SUCCEEDED row wins. This also runs the same conditional handoff as a worker.
        const advanced = await recordCategoryOutcome(run.id, category, { error });
        summary.categoriesFailed++;
        if (advanced) summary.advanced++;
      }
    }
    // Covers a worker that saved its result but died before running the handoff UPDATE
    if (await advanceToAggregating(run.id)) summary.advanced++;
  }

  // 3. QUEUED too long with no jobs at all: the API died between inserting the run and
  //    enqueueing. (Jobs merely waiting in a long backlog are left alone.)
  const queued = await prisma.analysisRun.findMany({
    where: { status: 'QUEUED', createdAt: { lt: ago(limits.queuedStaleMs) } },
    select: { id: true }, take: BATCH,
  });
  for (const { id } of queued) {
    const states = await Promise.all(CATEGORIES.map(c => jobState(categoryQueue(c), id)));
    if (states.every(s => s.state === 'missing')) {
      await markRunFailed(id, 'no category jobs found — enqueue never happened');
      summary.queuedFailed++;
    }
  }

  return summary;
}

let timer = null;
// setInterval rather than a BullMQ repeatable job: simpler, and because every sweeper action
// is conditional/idempotent, two worker processes sweeping at once is harmless.
export function startSweeper(intervalMs = 60_000) {
  const tick = () => sweepStuckRuns()
    .then(s => { if (Object.values(s).some(n => n > 0)) console.log('[sweeper]', s); })
    .catch(err => console.error('[sweeper] error:', err.message));
  tick();   // once at startup: catches runs orphaned by the crash that caused this restart
  timer = setInterval(tick, intervalMs);
}

export function stopSweeper() {
  clearInterval(timer);
  timer = null;
}

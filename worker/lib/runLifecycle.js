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

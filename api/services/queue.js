import { Queue } from 'bullmq';
import prisma from '../lib/prisma.js';

const connection = { url: process.env.REDIS_URL };

const queues = {
  complexity: new Queue('complexity-queue', { connection }),
  deadcode:   new Queue('deadcode-queue',   { connection }),
  vuln:       new Queue('vuln-queue',       { connection }),
  coverage:   new Queue('coverage-queue',   { connection }),
  drift:      new Queue('drift-queue',      { connection }),
};

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
};

// Shared by both entry points: record the run in Postgres FIRST, then enqueue.
// Order matters — if we enqueued first and crashed before the insert, workers would
// run jobs for a run that no status endpoint could ever find.
async function createRunAndEnqueue(payload) {
  const run = await prisma.analysisRun.create({
    data: { repoId: payload.repoId, commitSha: payload.commitSha },
  });

  try {
    await Promise.all(
      Object.values(queues).map(q =>
        // jobId = runId: BullMQ ignores an add() whose jobId already exists in that queue,
        // so enqueueing the same run twice can't create duplicate jobs. Each category has
        // its own queue, so runId alone is unique. (BullMQ forbids ':' in custom ids.)
        q.add('analyze', { ...payload, runId: run.id }, { ...defaultJobOptions, jobId: run.id })
      )
    );
  } catch (err) {
    // Without this, a Redis outage here would leave the run QUEUED forever
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', error: `enqueue failed: ${err.message}`, finishedAt: new Date() },
    });
    throw err;
  }

  return run.id;
}

export async function fanOut(payload) {
  const runId = await createRunAndEnqueue(payload);
  console.log(`[queue] Fanned out run ${runId} for repo ${payload.repoId}`);
  return runId;
}

export async function fanOutPublic(payload) {
  const runId = await createRunAndEnqueue({ ...payload, source: 'public_url', installationId: null });
  console.log(`[queue] Fanned out public run ${runId} for repo ${payload.repoId}`);
  return runId;
}


export { queues };

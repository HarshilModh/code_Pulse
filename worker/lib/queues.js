import { Queue } from 'bullmq';

export const CATEGORIES = ['complexity', 'deadcode', 'vuln', 'coverage', 'drift'];

const AGGREGATOR_JOB_OPTIONS = { attempts: 5, backoff: { type: 'exponential', delay: 2000 } };

// One Queue (one Redis connection) per name for the whole process. Previously each worker
// created a new Queue on every handoff and never closed it — a slow connection leak.
// Created lazily so REDIS_URL is read after dotenv has run, not at import time.
const cache = new Map();
function queue(name) {
  if (!cache.has(name)) cache.set(name, new Queue(name, { connection: { url: process.env.REDIS_URL } }));
  return cache.get(name);
}

export const categoryQueue = category => queue(`${category}-queue`);
export const aggregatorQueue = () => queue('aggregator-queue');

// Safe to call any number of times: jobId = runId, and BullMQ ignores an add() whose id
// already exists in the queue. That's what lets the handoff, a re-delivered category job
// and the periodic sweeper all "make sure aggregation is enqueued" without coordinating.
export async function ensureAggregationEnqueued(runId) {
  await aggregatorQueue().add('aggregate', { runId }, { ...AGGREGATOR_JOB_OPTIONS, jobId: runId });
}

export async function closeQueues() {
  await Promise.all([...cache.values()].map(q => q.close()));
  cache.clear();
}

// Integration: REAL Postgres, REAL Redis, REAL BullMQ workers and retries, the REAL API fan-out
// and the REAL aggregator. Only two things are faked: the five analysis functions (so no GitHub
// calls — they're not what's under test) and the PR-comment poster (it talks to GitHub).
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.mock('../../../api/services/prComment.js', () => ({ postPRComment: vi.fn(async () => {}) }));

import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import prisma from '../../../api/lib/prisma.js';
import { fanOutPublic, queues as apiQueues } from '../../../api/services/queue.js';
import { withRunTracking } from '../../lib/runLifecycle.js';
import { categoryQueue, aggregatorQueue, ensureAggregationEnqueued, closeQueues } from '../../lib/queues.js';
import { processAggregator } from '../../workers/aggregator.js';
import { assertSafeTestTargets } from '../testEnv.js';
import { CATEGORIES, REPORTS, resetDb, createRepo, getRun, until } from '../helpers.js';

const connection = { url: process.env.REDIS_URL };
const ALL_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'completed', 'failed'];
let redis, workers, insightsQueue, repo;

// Fake analysis: return the canned report, or throw for categories listed in job.data.fail
const fakeAnalysis = cat => async job => {
  if (job.data.fail?.includes(cat)) throw new Error(`${cat} exploded`);
  return REPORTS[cat];
};

// Wait until no job anywhere is still pending — i.e. every delivery, duplicate or not, has run
const allQueuesIdle = () => until(async () => {
  for (const q of [...CATEGORIES.map(categoryQueue), aggregatorQueue()]) {
    const c = await q.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
    if (Object.values(c).some(n => n > 0)) return false;
  }
  return true;
}, { timeout: 20_000 });

const jobsWithId = async (queue, id) => (await queue.getJobs(ALL_STATES)).filter(j => j.id === id);

beforeAll(async () => {
  assertSafeTestTargets(process.env.DATABASE_URL, process.env.REDIS_URL);   // flushdb below is destructive
  redis = new Redis(process.env.REDIS_URL);
  await redis.flushdb();
  insightsQueue = new Queue('insights-queue', { connection });
  workers = [
    ...CATEGORIES.map(c => new Worker(`${c}-queue`, withRunTracking(c, fakeAnalysis(c)), { connection, concurrency: 5 })),
    new Worker('aggregator-queue', processAggregator, { connection, concurrency: 5 }),
  ];
  await Promise.all(workers.map(w => w.waitUntilReady()));
  for (const m of ['log', 'warn', 'error']) vi.spyOn(console, m).mockImplementation(() => {});
});

afterAll(async () => {
  await Promise.all(workers.map(w => w.close()));
  await Promise.all([insightsQueue.close(), closeQueues(), ...Object.values(apiQueues).map(q => q.close())]);
  await redis.flushdb();
  await redis.quit();
});

beforeEach(async () => {
  await resetDb();
  repo = await createRepo();
});

const payload = () => ({ repoId: repo.id, owner: 'o', repoName: 'n', commitSha: 'abc123', ref: 'abc123', changedFiles: [] });

describe('pipeline against real Postgres + Redis', () => {
  it('every category job delivered twice → one snapshot, five results, one insights job', async () => {
    const runId = await fanOutPublic(payload());
    // Simulate re-delivery: a second copy of every category job under a different jobId,
    // so BullMQ really runs each category twice, concurrently with the originals
    await Promise.all(CATEGORIES.map(c =>
      categoryQueue(c).add('analyze', { ...payload(), runId }, { jobId: `${runId}-dup` })));

    await until(async () => (await getRun(runId)).status === 'SUCCEEDED');
    await allQueuesIdle();

    const run = await getRun(runId);
    expect(run.categoryResults).toHaveLength(5);
    expect(run.categoryResults.every(r => r.status === 'SUCCEEDED')).toBe(true);
    expect(await prisma.snapshot.count({ where: { repoId: repo.id } })).toBe(1);
    expect(await jobsWithId(insightsQueue, run.snapshot.id)).toHaveLength(1);
  });

  it('aggregation delivered again after success (and categories re-delivered) → still one snapshot', async () => {
    const runId = await fanOutPublic(payload());
    await until(async () => (await getRun(runId)).status === 'SUCCEEDED');
    const firstSnapshotId = (await getRun(runId)).snapshot.id;

    // A second aggregation job under a new id (BullMQ would otherwise ignore it) plus late
    // duplicates of every category, e.g. from stalled-job redelivery
    await aggregatorQueue().add('aggregate', { runId }, { jobId: `${runId}-again` });
    await Promise.all(CATEGORIES.map(c =>
      categoryQueue(c).add('analyze', { ...payload(), runId }, { jobId: `${runId}-late` })));
    await allQueuesIdle();

    const snapshots = await prisma.snapshot.findMany({ where: { repoId: repo.id } });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].id).toBe(firstSnapshotId);
    expect((await getRun(runId)).status).toBe('SUCCEEDED');
  });

  it('real BullMQ ignores a second add() with the same jobId (the dedupe the handoff relies on)', async () => {
    const runId = await fanOutPublic(payload());
    await until(async () => (await getRun(runId)).status === 'SUCCEEDED');
    await ensureAggregationEnqueued(runId);
    await ensureAggregationEnqueued(runId);
    await allQueuesIdle();
    expect(await jobsWithId(aggregatorQueue(), runId)).toHaveLength(1);
    expect(await prisma.snapshot.count({ where: { repoId: repo.id } })).toBe(1);
  });

  it('a category that fails every real BullMQ retry ends the run FAILED instead of hanging', async () => {
    const run = await prisma.analysisRun.create({ data: { repoId: repo.id, commitSha: 'abc123' } });
    await Promise.all(CATEGORIES.map(c => categoryQueue(c).add('analyze', { ...payload(), runId: run.id, fail: ['drift'] },
      { jobId: run.id, attempts: 3, backoff: { type: 'fixed', delay: 50 } })));

    const done = await until(async () => { const r = await getRun(run.id); return r.status === 'FAILED' && r; });
    expect(done.categoryResults.find(r => r.category === 'drift')).toMatchObject({ status: 'FAILED', error: 'drift exploded' });
    expect(done.error).toMatch(/drift/);
    const [driftJob] = await jobsWithId(categoryQueue('drift'), run.id);
    expect(driftJob.attemptsMade).toBe(3);            // BullMQ really retried it 3 times
    expect(done.snapshot).toBeNull();
  });
});

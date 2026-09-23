// Coordination tests: REAL Postgres (the races we care about live in SQL), FAKE queues (so each
// test controls exactly which job finishes when). GitHub / Redis pub-sub are faked out.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/queues.js', async importOriginal => {
  const actual = await importOriginal();
  const { fakeQueue } = await import('../fakeQueue.js');
  return {
    ...actual,
    categoryQueue: c => fakeQueue(`${c}-queue`),
    aggregatorQueue: () => fakeQueue('aggregator-queue'),
    // Same contract as the real one: jobId = runId, duplicates ignored (FakeQueue.add)
    ensureAggregationEnqueued: runId => fakeQueue('aggregator-queue').add('aggregate', { runId }, { jobId: runId }),
    closeQueues: async () => {},
  };
});
// The aggregator creates its own Queue / Redis connections at import time
vi.mock('bullmq', async () => {
  const { fakeQueue } = await import('../fakeQueue.js');
  return { Queue: class { constructor(name) { return fakeQueue(name); } } };
});
vi.mock('ioredis', () => ({ default: class { publish() { return Promise.resolve(1); } } }));
// api/services/octokit.js reads the GitHub private key when imported; GitHub is out of scope here
vi.mock('../../../api/services/prComment.js', () => ({ postPRComment: vi.fn(async () => {}) }));

import prisma from '../../../api/lib/prisma.js';
import { withRunTracking, recordCategoryOutcome, claimPrComment } from '../../lib/runLifecycle.js';
import { processAggregator } from '../../workers/aggregator.js';
import { sweepStuckRuns } from '../../lib/sweeper.js';
import { fakeQueue, resetFakeQueues } from '../fakeQueue.js';
import { CATEGORIES, REPORTS, resetDb, createRepo, createRun, getRun, fakeJob, minutes, permutations } from '../helpers.js';

// A processor that returns the canned report, or throws if told to
const processor = cat => vi.fn(async job => {
  if (job.data.fail?.includes(cat)) throw new Error(`${cat} exploded`);
  return REPORTS[cat];
});
// Deliver one category job for `runId` through the real wrapper
const deliver = (runId, cat, { fail = [], attemptsMade = 0, attempts = 5 } = {}) =>
  withRunTracking(cat, processor(cat))(fakeJob({ runId, fail }, { attemptsMade, attempts }));
// Deliver all five, in order, successfully
const deliverAll = async (runId, order = CATEGORIES) => { for (const c of order) await deliver(runId, c); };
const aggregatorJobs = () => fakeQueue('aggregator-queue').jobs;
const aggregate = (runId, { attemptsMade = 0 } = {}) =>
  processAggregator(fakeJob({ runId }, { attemptsMade, attempts: 5 }));

let repo;
beforeEach(async () => {
  await resetDb();
  resetFakeQueues();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  repo = await createRepo();
});

describe('results arriving out of order', () => {
  it('every one of the 120 completion orders hands off exactly once, and only after the 5th', async () => {
    let checked = 0;
    for (const order of permutations(CATEGORIES)) {
      const run = await createRun(repo.id);
      for (const [i, cat] of order.entries()) {
        await deliver(run.id, cat);
        const { status } = await prisma.analysisRun.findUnique({ where: { id: run.id } });
        const isLast = i === order.length - 1;
        expect(status, `order ${order} after ${cat}`).toBe(isLast ? 'AGGREGATING' : 'RUNNING');
        expect(aggregatorJobs().has(run.id)).toBe(isLast);
      }
      checked++;
    }
    expect(checked).toBe(120);
  });

  it('all five finishing at the same instant: exactly one caller advances the run (×25)', async () => {
    for (let i = 0; i < 25; i++) {
      const run = await createRun(repo.id, { status: 'RUNNING', startedAt: new Date() });
      const advanced = await Promise.all(CATEGORIES.map(c => recordCategoryOutcome(run.id, c, { report: REPORTS[c] })));
      expect(advanced.filter(Boolean)).toHaveLength(1);
      expect((await getRun(run.id)).status).toBe('AGGREGATING');
    }
    expect(aggregatorJobs().size).toBe(25);
  });
});

describe('one category failing', () => {
  it('failures before the last attempt record nothing — BullMQ will retry', async () => {
    const run = await createRun(repo.id);
    await expect(deliver(run.id, 'vuln', { fail: ['vuln'], attemptsMade: 0 })).rejects.toThrow('vuln exploded');
    await expect(deliver(run.id, 'vuln', { fail: ['vuln'], attemptsMade: 3 })).rejects.toThrow();
    expect((await getRun(run.id)).categoryResults).toHaveLength(0);
  });

  it('a retry that succeeds after earlier failures counts as success', async () => {
    const run = await createRun(repo.id);
    await expect(deliver(run.id, 'vuln', { fail: ['vuln'], attemptsMade: 0 })).rejects.toThrow();
    await deliverAll(run.id);
    await aggregate(run.id);
    expect((await getRun(run.id)).status).toBe('SUCCEEDED');
  });

  it('the final failed attempt records FAILED, the run still hands off, and ends FAILED — not stuck', async () => {
    const run = await createRun(repo.id);
    for (const c of ['complexity', 'deadcode', 'coverage', 'drift']) await deliver(run.id, c);
    await expect(deliver(run.id, 'vuln', { fail: ['vuln'], attemptsMade: 4, attempts: 5 })).rejects.toThrow('vuln exploded');

    const handedOff = await getRun(run.id);
    expect(handedOff.categoryResults.find(r => r.category === 'vuln')).toMatchObject({ status: 'FAILED', error: 'vuln exploded' });
    expect(handedOff.status).toBe('AGGREGATING');

    await aggregate(run.id);
    const done = await getRun(run.id);
    expect(done.status).toBe('FAILED');
    expect(done.error).toMatch(/vuln \(vuln exploded\)/);
    expect(done.snapshot).toBeNull();
  });
});

describe('the same job delivered twice', () => {
  it('sequential duplicate: still one row per category and one hand-off', async () => {
    const run = await createRun(repo.id);
    await deliver(run.id, 'complexity');
    await deliver(run.id, 'complexity');
    await deliverAll(run.id);
    const r = await getRun(run.id);
    expect(r.categoryResults).toHaveLength(5);
    expect(aggregatorJobs().size).toBe(1);
  });

  it('every category delivered twice concurrently: 5 rows, 1 aggregation job', async () => {
    const run = await createRun(repo.id);
    await Promise.all([...CATEGORIES, ...CATEGORIES].map(c => deliver(run.id, c)));
    const r = await getRun(run.id);
    expect(r.categoryResults).toHaveLength(5);
    expect(r.status).toBe('AGGREGATING');
    expect(aggregatorJobs().size).toBe(1);
  });

  it('a failing duplicate cannot overwrite a success for the same category', async () => {
    const run = await createRun(repo.id);
    await deliver(run.id, 'vuln');
    await expect(deliver(run.id, 'vuln', { fail: ['vuln'], attemptsMade: 4 })).rejects.toThrow();
    const vuln = (await getRun(run.id)).categoryResults.find(r => r.category === 'vuln');
    expect(vuln.status).toBe('SUCCEEDED');
  });

  it('a duplicate arriving after the run finished is skipped and cannot change results', async () => {
    const run = await createRun(repo.id);
    await deliverAll(run.id);
    await aggregate(run.id);
    const before = (await getRun(run.id)).categoryResults.find(r => r.category === 'drift').updatedAt;
    const proc = processor('drift');
    const out = await withRunTracking('drift', proc)(fakeJob({ runId: run.id }));
    expect(out).toEqual({ skipped: true });
    expect(proc).not.toHaveBeenCalled();
    expect((await getRun(run.id)).categoryResults.find(r => r.category === 'drift').updatedAt).toEqual(before);
  });
});

describe('a slow duplicate that finishes after the hand-off', () => {
  it('cannot change results the snapshot was built from (results freeze once the run leaves RUNNING)', async () => {
    const run = await createRun(repo.id);
    for (const c of ['complexity', 'deadcode', 'vuln', 'coverage']) await deliver(run.id, c);

    // A duplicate complexity delivery starts while the run is RUNNING (so it passes the
    // wrapper's entry check), then stalls inside the analysis...
    let release;
    const gate = new Promise(r => { release = r; });
    const slow = withRunTracking('complexity', async () => { await gate; return { ...REPORTS.complexity, avgComplexity: 99 }; });
    const slowDelivery = slow(fakeJob({ runId: run.id }));

    // ...meanwhile the last category lands, the run hands off, and aggregation completes
    await deliver(run.id, 'drift');
    await aggregate(run.id);
    expect((await getRun(run.id)).status).toBe('SUCCEEDED');

    // Now the slow duplicate finishes with DIFFERENT numbers
    release();
    await slowDelivery;
    const complexity = (await getRun(run.id)).categoryResults.find(r => r.category === 'complexity');
    expect(complexity.report.avgComplexity).toBe(3);   // unchanged: still matches the snapshot
  });
});

describe('aggregation running twice', () => {
  it('sequentially: one snapshot, same id, one insights job', async () => {
    const run = await createRun(repo.id);
    await deliverAll(run.id);
    const a = await aggregate(run.id);
    const b = await aggregate(run.id);
    expect(a.snapshotId).toBe(b.snapshotId);
    expect(await prisma.snapshot.count({ where: { runId: run.id } })).toBe(1);
    expect(fakeQueue('insights-queue').jobs.size).toBe(1);
    expect((await getRun(run.id)).status).toBe('SUCCEEDED');
  });

  it('concurrently (e.g. stalled-job redelivery): one snapshot, no errors', async () => {
    const run = await createRun(repo.id);
    await deliverAll(run.id);
    const results = await Promise.allSettled([aggregate(run.id), aggregate(run.id), aggregate(run.id)]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(new Set(results.map(r => r.value.snapshotId)).size).toBe(1);
    expect(await prisma.snapshot.count({ where: { runId: run.id } })).toBe(1);
  });

  it('only the final aggregator attempt marks the run FAILED', async () => {
    const run = await createRun(repo.id, { status: 'AGGREGATING', startedAt: new Date() });
    // Only 4 of 5 results: the aggregator treats this as an error and throws
    for (const c of ['complexity', 'deadcode', 'vuln', 'coverage'])
      await prisma.categoryResult.create({ data: { runId: run.id, category: c, report: REPORTS[c] } });
    await expect(aggregate(run.id, { attemptsMade: 0 })).rejects.toThrow('missing category results: drift');
    expect((await getRun(run.id)).status).toBe('AGGREGATING');
    await expect(aggregate(run.id, { attemptsMade: 4 })).rejects.toThrow();
    expect((await getRun(run.id)).status).toBe('FAILED');
  });

  it('the PR comment claim is won by exactly one of many concurrent callers', async () => {
    const run = await createRun(repo.id);
    const wins = await Promise.all(Array.from({ length: 10 }, () => claimPrComment(run.id)));
    expect(wins.filter(Boolean)).toHaveLength(1);
  });
});

describe('sweeper (crashes that never reach a catch block)', () => {
  const later = m => ({ now: new Date(Date.now() + minutes(m)) });

  it('AGGREGATING with no aggregation job (crashed after advancing) → re-enqueues it', async () => {
    const run = await createRun(repo.id, { status: 'AGGREGATING', startedAt: new Date() });
    expect(aggregatorJobs().has(run.id)).toBe(false);
    await sweepStuckRuns(later(1));                        // too early: leave it
    expect(aggregatorJobs().has(run.id)).toBe(false);
    await sweepStuckRuns(later(3));
    expect(aggregatorJobs().has(run.id)).toBe(true);
  });

  it('AGGREGATING whose aggregation job died on its last attempt → run FAILED', async () => {
    const run = await createRun(repo.id, { status: 'AGGREGATING', startedAt: new Date() });
    await fakeQueue('aggregator-queue').add('aggregate', { runId: run.id }, { jobId: run.id });
    fakeQueue('aggregator-queue').setState(run.id, 'failed', 'job stalled more than allowable limit');
    await sweepStuckRuns(later(3));
    const r = await getRun(run.id);
    expect(r.status).toBe('FAILED');
    expect(r.error).toMatch(/stalled/);
  });

  it('RUNNING with a category whose job vanished → category FAILED, run hands off', async () => {
    const run = await createRun(repo.id);
    for (const c of ['complexity', 'deadcode', 'vuln', 'coverage']) await deliver(run.id, c);   // no drift job exists
    await sweepStuckRuns(later(3));
    const r = await getRun(run.id);
    expect(r.categoryResults.find(c => c.category === 'drift')).toMatchObject({ status: 'FAILED' });
    expect(r.status).toBe('AGGREGATING');
    expect(aggregatorJobs().has(run.id)).toBe(true);
  });

  it('RUNNING with a category job still pending → left alone until the 60-minute timeout', async () => {
    const run = await createRun(repo.id);
    for (const c of ['complexity', 'deadcode', 'vuln', 'coverage']) await deliver(run.id, c);
    await fakeQueue('drift-queue').add('analyze', { runId: run.id }, { jobId: run.id });
    fakeQueue('drift-queue').setState(run.id, 'active');
    await sweepStuckRuns(later(30));
    expect((await getRun(run.id)).status).toBe('RUNNING');
    await sweepStuckRuns(later(61));
    const r = await getRun(run.id);
    expect(r.categoryResults.find(c => c.category === 'drift').error).toMatch(/timed out/);
    expect(r.status).toBe('AGGREGATING');
  });

  it('RUNNING with all 5 results saved but no hand-off (crashed before the UPDATE) → sweeper hands off', async () => {
    const run = await createRun(repo.id, { status: 'RUNNING', startedAt: new Date() });
    for (const c of CATEGORIES) await prisma.categoryResult.create({ data: { runId: run.id, category: c, report: REPORTS[c] } });
    await sweepStuckRuns(later(3));
    expect((await getRun(run.id)).status).toBe('AGGREGATING');
    expect(aggregatorJobs().has(run.id)).toBe(true);
  });

  it('QUEUED with no jobs at all → FAILED; QUEUED with jobs waiting → left alone', async () => {
    const orphan = await createRun(repo.id);
    const backlog = await createRun(repo.id);
    for (const c of CATEGORIES) await fakeQueue(`${c}-queue`).add('analyze', { runId: backlog.id }, { jobId: backlog.id });
    await sweepStuckRuns(later(11));
    expect((await getRun(orphan.id)).status).toBe('FAILED');
    expect((await getRun(backlog.id)).status).toBe('QUEUED');
  });

  it('running the sweeper twice changes nothing the second time', async () => {
    const run = await createRun(repo.id);
    for (const c of ['complexity', 'deadcode', 'vuln', 'coverage']) await deliver(run.id, c);
    await sweepStuckRuns(later(3));
    const addsAfterFirst = fakeQueue('aggregator-queue').addCalls;
    const second = await sweepStuckRuns(later(3));
    expect(second.categoriesFailed).toBe(0);
    expect(fakeQueue('aggregator-queue').jobs.size).toBe(1);
    expect(fakeQueue('aggregator-queue').addCalls).toBe(addsAfterFirst);
  });
});

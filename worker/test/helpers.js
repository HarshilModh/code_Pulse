import prisma from '../../api/lib/prisma.js';

export const CATEGORIES = ['complexity', 'deadcode', 'vuln', 'coverage', 'drift'];

// Minimal but valid reports, shaped like what each worker returns
export const REPORTS = {
  complexity: { worker: 'complexity', avgComplexity: 3, files: [] },
  deadcode:   { worker: 'deadcode', deadExports: 0, deadCodeRatio: 0 },
  vuln:       { worker: 'vuln', critical: 0, high: 0, moderate: 0, low: 0, total: 0 },
  coverage:   { worker: 'coverage', coverage: null, delta: 0, hasLcov: false },
  drift:      { worker: 'drift', driftRatio: 0, flaggedFiles: [] },
};

// Empty every table the pipeline touches. TRUNCATE ... CASCADE follows foreign keys, so
// runs, results, snapshots, insights and findings go too. setup.js already verified the DB.
export async function resetDb() {
  await prisma.$executeRawUnsafe('TRUNCATE "User", "Repo" CASCADE');
}

let n = 0;
export async function createRepo() {
  n++;
  const user = await prisma.user.create({ data: { id: `test-user-${n}-${Date.now()}`, email: `t${n}-${Date.now()}@test.local` } });
  return prisma.repo.create({ data: { userId: user.id, githubRepoId: n, owner: 'o', name: 'n', source: 'public_url' } });
}

export const createRun = (repoId, data = {}) =>
  prisma.analysisRun.create({ data: { repoId, commitSha: 'abc123', ...data } });

export const getRun = id =>
  prisma.analysisRun.findUnique({ where: { id }, include: { categoryResults: true, snapshot: true } });

// What BullMQ hands a processor, reduced to the fields our code reads
export const fakeJob = (data, { attemptsMade = 0, attempts = 5 } = {}) =>
  ({ id: data.runId, data, attemptsMade, opts: { attempts } });

export const minutes = m => m * 60_000;
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function until(fn, { timeout = 15_000, interval = 50 } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(interval); }
  throw new Error('until(): condition not met in time');
}

export function* permutations(items) {
  if (items.length <= 1) { yield items; return; }
  for (let i = 0; i < items.length; i++)
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) yield [items[i], ...rest];
}

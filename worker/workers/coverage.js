import { getFileContent } from '../../api/services/octokit.js';
import prisma from '../../api/lib/prisma.js';
import { storeWorkerResult } from '../resultStore.js';
import { Queue } from 'bullmq';

// Common paths where CI tools write lcov reports
const LCOV_PATHS = [
  'coverage/lcov.info',
  'lcov.info',
  'coverage/lcov.dat',
  '.nyc_output/lcov.info',
];

// Parse lcov.info → overall line coverage ratio (0–1), or null if unparseable
function parseLcov(content) {
  let linesFound = 0;
  let linesHit = 0;
  for (const line of content.split('\n')) {
    if (line.startsWith('LF:')) linesFound += parseInt(line.slice(3), 10) || 0;
    if (line.startsWith('LH:')) linesHit += parseInt(line.slice(3), 10) || 0;
  }
  return linesFound > 0 ? linesHit / linesFound : null;
}

export const processCoverage = async (job) => {
  const { repoId, owner, repoName, installationId, commitSha, ref } = job.data;

  console.log(`[coverage] Checking coverage for ${owner}/${repoName}`);

  let coverageRatio = null;

  for (const lcovPath of LCOV_PATHS) {
    try {
      const content = await getFileContent(installationId, owner, repoName, lcovPath, ref);
      if (!content) continue;
      coverageRatio = parseLcov(content);
      if (coverageRatio !== null) {
        console.log(`[coverage] Found lcov at ${lcovPath} — ${(coverageRatio * 100).toFixed(1)}%`);
        break;
      }
    } catch (err) {
      console.error(`[coverage] Error reading ${lcovPath}:`, err.message);
    }
  }

  if (coverageRatio === null) {
    console.log(`[coverage] No lcov report found for ${owner}/${repoName} — defaulting to 0`);
  }

  // Delta vs previous snapshot
  let delta = 0;
  if (coverageRatio !== null) {
    const lastSnapshot = await prisma.snapshot.findFirst({
      where: { repoId },
      orderBy: { createdAt: 'desc' },
    });
    if (lastSnapshot) {
      delta = coverageRatio - lastSnapshot.coverage;
      console.log(`[coverage] Delta: ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`);
    }
  }

  const finalReport = {
    worker: 'coverage',
    repoId,
    commitSha,
    coverage: coverageRatio ?? 0,
    delta,
    hasLcov: coverageRatio !== null,
  };

  const { complete, results: allResults } = await storeWorkerResult(repoId, commitSha, 'coverage', finalReport);

  if (complete) {
    const aggregatorQueue = new Queue('aggregator-queue', { connection: { url: process.env.REDIS_URL } });
    await aggregatorQueue.add('aggregate', { repoId, commitSha, owner, repoName, results: allResults });
    console.log(`[coverage] All workers done — triggering aggregator for ${commitSha.slice(0, 8)}`);
  }

  return finalReport;
};

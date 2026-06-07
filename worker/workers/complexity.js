import { fetchFile } from '../lib/fetchFile.js';
import prisma from '../../api/lib/prisma.js';
import { storeWorkerResult } from '../resultStore.js';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
// Regex-based cyclomatic complexity — works on JS/JSX/TS/TSX without a parser
function calcComplexity(content) {
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/.*/g, '')              // line comments
    .replace(/`[^`]*`/g, '""')          // template literals
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')  // strings
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''");
  const branches = /\bif\b|\belse\s+if\b|\bfor\b|\bwhile\b|\bdo\b|\bcase\b|\bcatch\b|\b\?\s*[^:]/g;
  const logicalOps = /&&|\|\||\?\?/g;
  const branchCount = (stripped.match(branches) ?? []).length;
  const logicalCount = (stripped.match(logicalOps) ?? []).length;
  return 1 + branchCount + logicalCount;
}

const redis = new Redis(process.env.REDIS_URL);

export const processComplexity = async (job) => {
    const { repoId, owner, repoName, installationId, commitSha, ref, changedFiles } = job.data;

    console.log(`[complexity] Processing ${changedFiles.length} files for repo ${repoId}`);
    const results = [];

    // 2. Filter JS/TS files only
    const jsFiles = changedFiles.filter(f => f.match(/\.(js|jsx|ts|tsx)$/));
    await redis.publish('codepulse:worker-event', JSON.stringify({
        repoId,
        commitSha,
        worker: 'complexity',
        phase: 'start',
        fileProcessed: 0,
        totalFiles: jsFiles.length,
    }));    

    for (const filePath of jsFiles) {
        try {
            // 3. Fetch file content from GitHub
            const content = await fetchFile(job.data, filePath)
            if (!content) continue;

            // 4. Regex-based cyclomatic complexity (works on JS/JSX/TS/TSX)
            const complexity = calcComplexity(content);

            // Upsert the file-level record
            const fileAnalysis = await prisma.fileAnalysis.upsert({
                where: { repoId_filePath: { repoId, filePath } },
                update: { complexity },
                create: { repoId, filePath, complexity, snapshotId: null, driftScore: null, isDead: false },
            });
            results.push({ filePath, complexity });

        } catch (err) {
            console.error(`[complexity] Error processing ${filePath}:`, err.message);
        }
    }

    const finalReport = {
      worker: 'complexity',
      repoId,
      commitSha,
      avgComplexity: results.length > 0
        ? results.reduce((sum, r) => sum + r.complexity, 0) / results.length
        : 0,
      // files array consumed by aggregator.emitFindings to generate complexity Findings
      files: results,
    };

    const { complete, results: allResults } = await storeWorkerResult(repoId, commitSha, 'complexity', finalReport);

    if (complete) {
      const aggregatorQueue = new Queue('aggregator-queue', { connection: { url: process.env.REDIS_URL } });
      await aggregatorQueue.add('aggregate', { repoId, commitSha, owner, repoName, results: allResults });
      console.log(`[complexity] All workers done — triggering aggregator for ${commitSha.slice(0, 8)}`);
    }
    await redis.publish('codepulse:worker-event', JSON.stringify({
        repoId,
        commitSha,
        worker: 'complexity',
        phase: 'done',
        fileProcessed: results.length,
        totalFiles: jsFiles.length,
    }));
    return finalReport;
}
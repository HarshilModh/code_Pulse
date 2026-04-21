import { getFileContent } from '../../api/services/octokit.js';
import prisma from '../../api/lib/prisma.js';
import { storeWorkerResult } from '../resultStore.js';
import { Queue } from 'bullmq';
// @ts-ignore
import escomplex from 'escomplex';
export const processComplexity = async (job) => {
    const { repoId, owner, repoName, installationId, commitSha, ref, changedFiles } = job.data;

    console.log(`[complexity] Processing ${changedFiles.length} files for repo ${repoId}`);
    const results = [];

    // 2. Filter JS/TS files only
    const jsFiles = changedFiles.filter(f => f.match(/\.(js|jsx|ts|tsx)$/));

    for (const filePath of jsFiles) {
        try {
            // 3. Fetch file content from GitHub
            const content = await getFileContent(installationId, owner, repoName, filePath, ref);
            if (!content) continue;

            // 4. Run escomplex
            const report = escomplex.analyse(content, { noCoreSize: true });

            // 5. Calculate average complexity
            const complexity = report.functions.length > 0
                ? report.functions.reduce((sum, fn) => sum + fn.cyclomatic, 0) / report.functions.length
                : 1;

            await prisma.fileAnalysis.upsert({
                where: {
                    repoId_filePath: {
                        repoId,
                        filePath,
                    }
                },
                update: {
                    complexity,

                },
                create: {
                    repoId,
                    filePath,
                    complexity,
                    snapshotId: null,
                    driftScore: null,
                    isDead: false,
                }
            })
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
    };

    const { complete, results: allResults } = await storeWorkerResult(repoId, commitSha, 'complexity', finalReport);

    if (complete) {
        const aggregatorQueue = new Queue('aggregator-queue', { connection: { url: process.env.REDIS_URL } });
        await aggregatorQueue.add('aggregate', { repoId, commitSha, owner, repoName, results: allResults });
        console.log(`[complexity] All workers done — triggering aggregator for ${commitSha.slice(0, 8)}`);
    }

    return finalReport;
}
import { getFileContent } from "../../api/services/octokit.js";
import { storeWorkerResult } from '../resultStore.js';
import { Queue } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

export const processVuln = async (job) => {
    const { repoId, owner, repoName, installationId, commitSha } = job.data;

    console.log(`[vuln] Checking vulnerabilities for ${owner}/${repoName}`);

    // Vulnerability scanning requires package-lock.json, not individual source files
    const lockContent = await getFileContent(installationId, owner, repoName, 'package-lock.json', commitSha);

    let vulnCounts = { critical: 0, high: 0, moderate: 0, low: 0, total: 0 };

    if (!lockContent) {
        console.log(`[vuln] No package-lock.json found for ${owner}/${repoName} — skipping`);
    } else {
        const tmpDir = join(tmpdir(), `cp-vuln-${repoId.slice(0, 8)}`);
        try {
            await mkdir(tmpDir, { recursive: true });
            await writeFile(join(tmpDir, 'package-lock.json'), lockContent);
            await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'scan', version: '1.0.0' }));

            // npm audit exits with non-zero when vulns found — catch the error but still parse stdout
            const { stdout } = await execFileAsync('npm', ['audit', '--json'], { cwd: tmpDir })
                .catch(e => ({ stdout: e.stdout ?? '{}' }));

            const meta = JSON.parse(stdout)?.metadata?.vulnerabilities ?? {};
            vulnCounts = {
                critical: meta.critical ?? 0,
                high:     meta.high ?? 0,
                moderate: meta.moderate ?? 0,
                low:      meta.low ?? 0,
                total:    meta.total ?? 0,
            };
        } catch (err) {
            console.error(`[vuln] npm audit failed:`, err.message);
        } finally {
            await rm(tmpDir, { recursive: true, force: true });
        }
    }

    console.log(`[vuln] ${owner}/${repoName} — ${vulnCounts.total} vulnerabilities (${vulnCounts.critical} critical, ${vulnCounts.high} high)`);

    const finalReport = {
        worker: 'vuln',
        repoId,
        commitSha,
        ...vulnCounts,
    };

    const { complete, results: allResults } = await storeWorkerResult(repoId, commitSha, 'vuln', finalReport);

    if (complete) {
        const aggregatorQueue = new Queue('aggregator-queue', { connection: { url: process.env.REDIS_URL } });
        await aggregatorQueue.add('aggregate', { repoId, commitSha, owner, repoName, results: allResults });
        console.log(`[vuln] All workers done — triggering aggregator for ${commitSha.slice(0, 8)}`);
    }

    return finalReport;
};

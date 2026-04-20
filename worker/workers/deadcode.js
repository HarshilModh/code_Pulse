import { getFileContent, getRepoTree } from '../../api/services/octokit.js';
import prisma from '../../api/lib/prisma.js';
import { storeWorkerResult } from '../resultStore.js';
import { Queue } from 'bullmq';

const JS_TS = /\.(js|jsx|ts|tsx)$/;

// Extract named exports from source: export const/function/class/let/var foo
// Also handles: export { foo, bar } and export { foo as bar }
function parseExports(src) {
  const names = new Set();

  // export (const|let|var|function|class|async function) Name
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+(\w+)/gm)) {
    names.add(m[1]);
  }

  // export { foo, foo as bar, ... }
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      // "foo as bar" → exported name is "bar"; plain "foo" → "foo"
      const alias = part.trim().match(/(?:.*\bas\s+)?(\w+)\s*$/);
      if (alias) names.add(alias[1]);
    }
  }

  return names;
}

// Collect all imported names across a source file
function parseImports(src) {
  const names = new Set();

  // import { foo, bar as baz } from '...'
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from/g)) {
    for (const part of m[1].split(',')) {
      // "foo as local" → the exported name is "foo"
      const orig = part.trim().match(/^(\w+)/);
      if (orig) names.add(orig[1]);
    }
  }

  // import defaultName from '...'  — not a named export, skip
  // import * as ns from '...'      — namespace, can't statically resolve, skip

  return names;
}

export const processDeadCode = async (job) => {
  const { repoId, owner, repoName, installationId, commitSha, ref, changedFiles } = job.data;

  console.log(`[deadcode] Analysing dead exports for ${owner}/${repoName}`);

  try {
    // 1. Get full repo file tree so we can build the import graph
    const allPaths = await getRepoTree(installationId, owner, repoName, ref);
    const jsPaths = allPaths.filter(p => JS_TS.test(p));

    // 2. Fetch all JS/TS sources (cap at 300 files to stay within rate limits)
    const fetchPaths = jsPaths.slice(0, 300);
    const sources = await Promise.all(
      fetchPaths.map(async p => ({
        path: p,
        src: await getFileContent(installationId, owner, repoName, p, ref) ?? '',
      }))
    );

    // 3. Build a set of every imported name across the entire repo
    const allImportedNames = new Set();
    for (const { src } of sources) {
      for (const name of parseImports(src)) allImportedNames.add(name);
    }

    // 4. For each changed JS/TS file, check if any of its exports are never imported
    const changedJs = changedFiles.filter(p => JS_TS.test(p));
    const results = [];
    let totalDeadExports = 0;

    for (const filePath of changedJs) {
      try {
        const entry = sources.find(s => s.path === filePath);
        const src = entry?.src ?? await getFileContent(installationId, owner, repoName, filePath, ref) ?? '';

        const exported = parseExports(src);
        const deadExports = [...exported].filter(name => !allImportedNames.has(name));
        const isDead = deadExports.length > 0;

        if (isDead) {
          totalDeadExports += deadExports.length;
          console.log(`[deadcode] ${filePath} — dead exports: ${deadExports.join(', ')}`);
        }

        await prisma.fileAnalysis.upsert({
          where: { repoId_filePath: { repoId, filePath } },
          update: { isDead },
          create: { repoId, filePath, isDead, snapshotId: null, driftScore: null, embedding: null, complexity: 0 },
        });

        results.push({ filePath, isDead, deadExports });
      } catch (err) {
        console.error(`[deadcode] Error processing ${filePath}:`, err.message);
      }
    }

    const totalExports = results.reduce((sum, r) => sum + (r.deadExports?.length ?? 0) + 1, 0);
    const deadCodeRatio = totalExports > 0 ? totalDeadExports / totalExports : 0;

    const finalReport = {
      worker: 'deadcode',
      repoId,
      commitSha,
      deadExports: totalDeadExports,
      deadCodeRatio,
    };

    const { complete, results: allResults } = await storeWorkerResult(repoId, commitSha, 'deadcode', finalReport);

    if (complete) {
      const aggregatorQueue = new Queue('aggregator-queue', { connection: { url: process.env.REDIS_URL } });
      await aggregatorQueue.add('aggregate', { repoId, commitSha, owner, repoName, results: allResults });
      console.log(`[deadcode] All workers done — triggering aggregator for ${commitSha.slice(0, 8)}`);
    }

    return finalReport;
  } catch (err) {
    console.error(`[deadcode] Fatal error:`, err.message);
    throw err;
  }
};

import express from 'express';
import { verifyGithubSignature } from '../middleware/verifyGithub.js';
import { fanOut } from '../services/queue.js';
import prisma from '../lib/prisma.js';

const router = express.Router();

router.post('/', verifyGithubSignature, async (req, res) => {
  const event = req.headers['x-github-event'];

  // Only handle push events
  if (event !== 'push') return res.status(200).json({ skipped: true });

  const { repository, installation, commits, after: commitSha, ref } = req.body;

  // Ignore branch deletes
  if (commitSha === '0000000000000000000000000000000000000000') {
    return res.status(200).json({ skipped: 'branch deleted' });
  }

  // Collect all changed files across commits, deduplicate
  const changedFiles = [...new Set(
    commits.flatMap(c => [...(c.added || []), ...(c.modified || [])])
  )];

  // Upsert system user (temporary until Clerk auth is wired)
  await prisma.user.upsert({
    where: { id: 'system' },
    update: {},
    create: {
      id: 'system',
      email: 'system@codepulse.dev',
      plan: 'pro',
      repoLimit: 9999,
    },
  });

  // Upsert the repo — create if first push, update installationId if repo exists
  const repo = await prisma.repo.upsert({
    where: { githubRepoId: repository.id },
    update: { installationId: installation.id },
    create: {
      githubRepoId: repository.id,
      owner: repository.owner.login,
      name: repository.name,
      installationId: installation.id,
      userId: 'system',
    },
  });

  // Fan out to 5 analysis queues
  await fanOut({
    repoId: repo.id,
    owner: repository.owner.login,
    repoName: repository.name,
    installationId: installation.id,
    commitSha,
    ref,
    changedFiles,
  });

  console.log(`[webhook] ${repo.owner}/${repo.name} @ ${commitSha} — ${changedFiles.length} files`);
  res.status(200).json({ received: true, files: changedFiles.length });
});

export default router;
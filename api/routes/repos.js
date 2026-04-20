import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// GET /api/repos — fetch all repos for a user
router.get('/repos', async (req, res) => {
  try {
    const repos = await prisma.repo.findMany();
    res.json(repos);
  } catch (err) {
    console.error('[repos] Error fetching repos:', err);
    res.status(500).json({ error: 'Failed to fetch repos' });
  }
});

// GET /api/repos/:repoId/snapshots — fetch snapshots for a repo
router.get('/repos/:repoId/snapshots', async (req, res) => {
  try {
    const snapshots = await prisma.snapshot.findMany({
      where: { repoId: req.params.repoId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(snapshots);
  } catch (err) {
    console.error('[repos] Error fetching snapshots:', err);
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

export default router;
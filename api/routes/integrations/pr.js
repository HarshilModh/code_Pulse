import express from 'express';
import prisma from '../../lib/prisma.js';

const router = express.Router();

// PR comment setting is stored inside alertRules JSON as { type: 'pr_comments', enabled: bool }
// This avoids a schema migration while keeping it alongside other alert config.

function getPrEnabled(alertRules = []) {
  const rule = alertRules.find(r => r.type === 'pr_comments');
  return rule ? rule.enabled : false; // off by default
}

function setPrEnabled(alertRules = [], enabled) {
  const filtered = alertRules.filter(r => r.type !== 'pr_comments');
  return [...filtered, { type: 'pr_comments', enabled }];
}

// GET /api/repos/:id/integrations/pr — returns current toggle state
router.get('/repos/:id/integrations/pr', async (req, res) => {
  const repo = await prisma.repo.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!repo) return res.status(404).json({ error: 'Repo not found' });

  const settings = await prisma.repoSettings.findUnique({ where: { repoId: repo.id } });
  res.json({ enabled: getPrEnabled(settings?.alertRules ?? []) });
});

// PATCH /api/repos/:id/integrations/pr — toggle PR comments on or off
router.patch('/repos/:id/integrations/pr', async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' });

  const repo = await prisma.repo.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!repo) return res.status(404).json({ error: 'Repo not found' });

  const existing = await prisma.repoSettings.findUnique({ where: { repoId: repo.id } });
  const updatedRules = setPrEnabled(existing?.alertRules ?? [], enabled);

  await prisma.repoSettings.upsert({
    where: { repoId: repo.id },
    create: { repoId: repo.id, alertRules: updatedRules },
    update: { alertRules: updatedRules },
  });

  res.json({ enabled });
});

export default router;

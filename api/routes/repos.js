import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// GET /api/repos — fetch all repos for a user
router.get('/repos', async (req, res) => {
  try {
    const repos = await prisma.repo.findMany({
      where: { userId:req.userId },
    });
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
// GET /api/public/:owner/:name — public endpoint for badges and GitHub App readme links
router.get('/:owner/:name', async (req, res) => {                                                                                                                              
    const { owner, name } = req.params                      
                                                                                                                                                                                        
    const repo = await prisma.repo.findFirst({              
      where: { owner, name },                                                                                                                                                           
      select: { id: true, owner: true, name: true, source: true, lastAnalyzedAt: true },
    })                                                                                                                                                                                  
   
    if (!repo) return res.status(404).json({ error: 'Not found' })                                                                                                                      
                                                            
    const snapshot = await prisma.snapshot.findFirst({                                                                                                                                  
      where: { repoId: repo.id },
      orderBy: { createdAt: 'desc' },                                                                                                                                                   
      select: {                                             
        id: true, healthScore: true, complexity: true,
        vulnCount: true, deadCode: true, coverage: true,                                                                                                                                
        driftScore: true, createdAt: true, commitSha: true,
      },                                                                                                                                                                                
    })                                                      
                                                                                                                                                                                        
    res.json({ repo, snapshot })                            
  })

export default router;
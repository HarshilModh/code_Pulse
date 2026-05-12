import express from "express";
import prisma from "../lib/prisma.js";
const router = express.Router();


router.post('/demo/fork', async (req, res) => {
    const seedRepoId = process.env.DEMO_REPO_SEED_ID;
    if (!seedRepoId) return res.status(503).json({ error: 'Demo not configured' });                                                                                                     
                                                                                                                                                                                        
    try {                                                                                                                                                                               
      const seed = await prisma.repo.findUnique({                                                                                                                                       
        where: { id: seedRepoId },
        include: { snapshots: true },
      });                                                                                                                                                                               
      if (!seed) return res.status(404).json({ error: 'Seed repo not found' });
      
      // Ensure the user exists in the database before assigning a repo to them
      await prisma.user.upsert({
          where: { id: req.userId },
          update: {},
          create: { id: req.userId, email: `${req.userId}@unknown.com` },
      });

      const repo = await prisma.repo.upsert({                                                                                                                                           
        where: { userId_githubRepoId: { userId: req.userId, githubRepoId: seed.githubRepoId } },
        update: {},                                                                                                                                                                     
        create: { 
          userId: req.userId,
          githubRepoId: seed.githubRepoId,                                                                                                                                              
          owner: seed.owner,
          name: seed.name,                                                                                                                                                              
          source: 'demo',
          defaultBranch: seed.defaultBranch,
          isPublicDemo: true,                                                                                                                                                           
          lastAnalyzedAt: new Date(),
        },                                                                                                                                                                              
      });         
                                                                                                                                                                                        
      // Copy latest snapshot
      const latest = seed.snapshots.at(-1);
      if (latest) {                                                                                                                                                                     
        await prisma.snapshot.create({
          data: {                                                                                                                                                                       
            repoId: repo.id,
            commitSha: latest.commitSha,
            healthScore: latest.healthScore,                                                                                                                                            
            complexity: latest.complexity,
            vulnCount: latest.vulnCount,                                                                                                                                                
            deadCode: latest.deadCode,                                                                                                                                                  
            coverage: latest.coverage,
            driftScore: latest.driftScore,                                                                                                                                              
          },      
        });                                                                                                                                                                             
      }
                                                                                                                                                                                        
      res.json({ repoId: repo.id });
    } catch (err) {
      console.error('[demo]', err);
      res.status(500).json({ error: err.message });
    }
  });
export default router;
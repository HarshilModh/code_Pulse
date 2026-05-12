import express from 'express';
import prisma from '../../lib/prisma.js';
import { chatJSON } from '../../services/openAI.js';

const router = express.Router();

router.post('/repos/:id/agents/tour', async (req, res) => {
    const repoId = req.params.id;
    const repo = await prisma.repo.findFirst({ where: { id: repoId, userId: req.userId } });
    if (!repo) {
        return res.status(404).json({ error: 'Repo not found' });
    }
    const [snapshot,topFiles] = await Promise.all([
        prisma.snapshot.findFirst({ where: { repoId }, orderBy: { createdAt: 'desc' } }),
        prisma.fileAnalysis.findMany({ where: { repoId }, orderBy: { complexity: 'desc' }, take: 10, select: { filePath: true, complexity: true, isDead: true, driftScore: true } })  
    ]);
    const messages = [{                                                                                                                                                                 
      role: 'user',
      content: `Generate a 5-step codebase tour for ${repo.owner}/${repo.name}.                                                                                                         
  Health: ${snapshot ? `score ${snapshot.healthScore.toFixed(1)}, ${snapshot.vulnCount} vulns, complexity ${snapshot.complexity.toFixed(2)}` : 'no snapshot yet'}                       
  Top complex files: ${topFiles.slice(0, 5).map(f => f.filePath).join(', ')}                                                                                                            
                                                                                                                                                                                        
  Return JSON:                                                                                                                                                                          
  { "steps": [{ "title": string, "description": string, "files": string[], "insight": string }] }                                                                                       
                                                                                                                                                                                        
  Steps: 1) Entry points & architecture 2) Core data flow 3) Key abstractions 4) Risk hotspots 5) How to extend`,
    }];                                                                                                                                                                                 
                  
    try {                                                                                                                                                                               
      const result = await chatJSON(messages, 'You are a senior engineer giving a codebase orientation. Be concrete, cite specific files.');
      res.json(result);                                                                                                                                                                 
    } catch (err) {
      res.status(500).json({ error: err.message });                                                                                                                                     
    }     

});

export default router;
import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

router.get('/repos/:id/settings', async (req, res) => { 
    const repoId = req.params.id;
    const repo = await prisma.repo.findFirst({ where: { id: repoId, userId: req.userId } });
    if (!repo) {
        return res.status(404).json({ error: 'Repo not found' });
    }
    const settings = await prisma.repoSettings.findUnique({ where: { repoId } })

    // Return defaults if no settings row exists yet — upsert only happens on first PATCH
    if (!settings) {
      return res.json({
        repoId,
        driftThreshold: 0.72,   // matches the default in schema.prisma
        digestCadence: 'weekly',
        digestRecipients: [],
        alertRules: [],
      })
    }
    res.json(settings)                                                                                                                         
})                                                        

  router.patch('/repos/:id/settings', async (req, res) => {
    const repoId = req.params.id
    const { driftThreshold, digestCadence, digestRecipients, alertRules } = req.body
                                                                                                                                               
    const repo = await prisma.repo.findFirst({ where: { id: repoId, userId: req.userId } })
    if (!repo) return res.status(404).json({ error: 'Repo not found' })                                                                        
                                                                                                                                               
    if (driftThreshold !== undefined && (driftThreshold < 0 || driftThreshold > 1)) {
      return res.status(400).json({ error: 'driftThreshold must be between 0 and 1' })                                                         
    }                                                                                                                                          
   
    // upsert — first PATCH creates the row, subsequent ones update it                                                                         
    const settings = await prisma.repoSettings.upsert({     
      where: { repoId },                                                                                                                       
      create: {
        repoId,                                                                                                                                
        ...(driftThreshold !== undefined && { driftThreshold }),
        ...(digestCadence && { digestCadence }),
        ...(digestRecipients && { digestRecipients }),
        ...(alertRules && { alertRules }),                                                                                                     
      },
      update: {                                                                                                                                
        ...(driftThreshold !== undefined && { driftThreshold }),
        ...(digestCadence && { digestCadence }),
        ...(digestRecipients && { digestRecipients }),
        ...(alertRules && { alertRules }),                                                                                                     
      },
    })                                                                                                                                         
    res.json(settings)                                      
  })

  // driftThreshold is stored here but applied at read-time in the drift route —                                                               
  // changing it never re-runs analysis, it just shifts what gets flagged on the next fetch
                                                                                                                                               
  export default router; 
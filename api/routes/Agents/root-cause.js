import express from 'express';
import { chatStream } from '../../services/openAI.js';
import { openAITools } from '../../services/tools.js';
import prisma from '../../lib/prisma.js';

const router = express.Router();

router.post('/repos/:id/agents/root-cause', async (req, res) => {
    const repoId = req.params.id;
    const {metric='healthScore', direction='drop' } = req.body;
    const repo = await prisma.repo.findFirst({ where: { id: repoId ,userId: req.userId } });
    if (!repo) {
        return res.status(404).json({ error: 'Repo not found' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send=d=>res.write(`data: ${JSON.stringify(d)}\n\n`);
    const messages = [
      { role: 'system', content: `You are a code health investigator for ${repo.owner}/${repo.name}. Always pass repoId: "${repoId}" in every tool call. Use tools systematically: first
   get_snapshot_history to find the regression, then get_diff on the suspect commit, then read_file on affected paths. Be concise and cite specific files.` },                          
      { role: 'user', content: `Investigate the ${direction === 'drop' ? 'drop' : 'spike'} in ${metric}. What caused it and what should we do?` },
    ];   
    try {                                                                                                                                                                               
      for await (const event of chatStream(messages, { tools: openAITools, model: process.env.OPENAI_AGENT_MODEL ?? 'gpt-4o' })) {
        send(event);                                                                                                                                                                    
      }
    } catch (err) {                                                                                                                                                                     
      send({ type: 'error', message: err.message });
    } finally {                                                                                                                                                                         
      res.end();  
    }

});

export default router;
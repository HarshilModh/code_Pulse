import express from "express";
import { chatStream } from "../../services/openAI.js";
import { openAITools } from "../../services/tools.js";
import prisma from "../../lib/prisma.js";

const router = express.Router();

router.post("/repos/:id/agents/debate", async (req, res) => {
    const repoId = req.params.id;
    const { topic } = req.body;

    if (!topic) return res.status(400).json({ error: 'Topic is required' });
    const repo = await prisma.repo.findFirst({ where: { id: repoId, userId: req.userId } });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
    const proMessages = [{ role: 'system', content: `You are arguing FOR: "${topic}" for ${repo.owner}/${repo.name}. Always pass repoId: "${repoId}" in tool calls. Use evidence from   
  tools. 2-3 sentences per round.` }];
    const conMessages = [{ role: 'system', content: `You are arguing AGAINST: "${topic}" for ${repo.owner}/${repo.name}. Always pass repoId: "${repoId}" in tool calls. Use evidence    
  from tools. 2-3 sentences per round.` }];                                                                                                                                             
   
    try {                                                                                                                                                                               
      for (let round = 1; round <= 3; round++) {
        send({ type: 'round', round });                                                                                                                                                 
   
        proMessages.push({ role: 'user', content: round === 1 ? `Open your argument FOR: "${topic}"` : 'Respond to the opposition with evidence.' });                                   
        send({ type: 'persona_start', persona: 'pro' });
        let proText = '';                                                                                                                                                               
        for await (const event of chatStream(proMessages, { tools: openAITools })) {
          if (event.type === 'token') proText += event.content;                                                                                                                         
          send({ ...event, persona: 'pro' });
        }                                                                                                                                                                               
        proMessages.push({ role: 'assistant', content: proText });
        conMessages.push({ role: 'user', content: `They said: "${proText}". Rebut and argue AGAINST: "${topic}".` });                                                                   
                                                                                                                                                                                        
        send({ type: 'persona_start', persona: 'con' });
        let conText = '';                                                                                                                                                               
        for await (const event of chatStream(conMessages, { tools: openAITools })) {
          if (event.type === 'token') conText += event.content;                                                                                                                         
          send({ ...event, persona: 'con' });
        }                                                                                                                                                                               
        conMessages.push({ role: 'assistant', content: conText });
        proMessages.push({ role: 'user', content: `They said: "${conText}". Respond with evidence.` });                                                                                 
      }                                                                                                                                                                                 
      send({ type: 'done', reason: 'debate_complete' });                                                                                                                                
    } catch (err) {                                                                                                                                                                     
      send({ type: 'error', message: err.message });
    } finally {                                                                                                                                                                         
      res.end();
    }                                                                                                                                                                                               
});

export default router;
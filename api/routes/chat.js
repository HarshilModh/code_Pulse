import express from 'express';
import prisma from '../lib/prisma.js';
import {chatStream} from '../services/openAI.js';
import { openAITools } from '../services/tools.js';

const router = express.Router();

router.post('/repos/:id/chat', async (req, res) => {
    const repoId = req.params.id;
    const { messages = [], sessionId } = req.body;
    const repo = await prisma.repo.findFirst({ where: { id: repoId, userId: req.userId } });
    if (!repo) return res.status(404).json({ error: 'Repo not found' });

    let session = sessionId ? await prisma.chatSession.findUnique({ where: { id: sessionId } }) : null;
    if (!session) {
        session = await prisma.chatSession.create({ data: { repoId, userId: req.userId, mode: 'chat' } });
    }

    const lastUser = messages.at(-1);
    if (lastUser?.role === 'user' && lastUser.content) {
        await prisma.chatMessage.create({ data: { sessionId: session.id, role: 'user', content: lastUser.content } });
    }

    const fullMessages = [
        { role: 'system', content: `You are CodePulse AI, an expert analyst for ${repo.owner}/${repo.name}. Always pass repoId: "${repoId}" in every tool call. Cite specific files when possible.` },
        ...messages,
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = d => res.write(`data: ${JSON.stringify(d)}\n\n`);
    let assistantText = '';
    try {
        for await (const event of chatStream(fullMessages, { tools: openAITools })) {
            send(event);
            if (event.type === 'token') assistantText += event.content;
        }
        await prisma.chatMessage.create({ data: { sessionId: session.id, role: 'assistant', content: assistantText } });
        send({ type: 'session', sessionId: session.id });
    } catch (err) {
        send({ type: 'error', message: err.message });
    } finally {
        res.end();
    }
});

router.get('/repos/:id/chat/sessions', async (req, res) => {
    const sessions = await prisma.chatSession.findMany({
        where: { repoId: req.params.id, userId: req.userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { messages: { take: 1, orderBy: { createdAt: 'asc' } } },
    });
    res.json(sessions);
});

router.get('/repos/:id/chat/sessions/:sessionId', async (req, res) => {
    const session = await prisma.chatSession.findUnique({
        where: { id: req.params.sessionId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session || session.repoId !== req.params.id) {
        return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
});

export default router;
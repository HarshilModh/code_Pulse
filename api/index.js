import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {requireClerk} from './middleware/requireClerk.js';
import Redis from 'ioredis';
import cors from 'cors';
import webhookRouter from './routes/webhook.js';
import reposRouter from './routes/repos.js';
import analyzeRouter from './routes/analyze.js';
import installRouter from './routes/install.js';
import demoRouter from './routes/demo.js';
import insightsRouter from './routes/insights.js';
import chatRouter from './routes/chat.js';
import rootCauseRouter from './routes/Agents/root_Cause.js';
import debateRouter from './routes/Agents/debate.js';
import tourRouter from './routes/Agents/tour.js';
import findingsRouter from './routes/findings.js';
import filesRouter from './routes/files.js';
import apiKeysRouter from './routes/apiKeys.js';
import settingsRouter from './routes/settings.js';
import badgeRouter from './routes/badge.js';
import searchRouter from './routes/search.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3001' }));

// Capture rawBody BEFORE any parsing — required for HMAC verification
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = data ? JSON.parse(data) : {};
    } catch(e) {
      req.body = {};
    }
    next();
  });
});

app.use((req, res, next) => {
  console.log(`[request] ${req.method} ${req.url}`);
  next();
});

// Make io accessible in routes
app.set('io', io);

// Routes
app.get('/', (req, res) => res.json({ status: 'ok' }));
app.use('/webhook', webhookRouter);                                                                                                                                                   
app.use('/install', installRouter);          // public — no Clerk (GitHub redirects here)
app.use('/api', requireClerk, reposRouter);                                                                                                                                           
app.use('/api', requireClerk, analyzeRouter);                                                                                                                                         
app.use('/api', requireClerk, demoRouter);   
app.use('/api/snapshots', requireClerk, insightsRouter);
app.use('/api', requireClerk, chatRouter);
app.use('/api', requireClerk, rootCauseRouter);
app.use('/api', requireClerk, debateRouter);
app.use('/api', requireClerk, tourRouter);
app.use('/api', requireClerk, findingsRouter);
app.use('/api', requireClerk, filesRouter);
app.use('/api', requireClerk, apiKeysRouter);
app.use('/api', requireClerk, settingsRouter);
app.use('/api/public', badgeRouter);                   // public — no auth, not under /api (README embeds)
app.use('/api', requireClerk, searchRouter);
app.use("/api/public", reposRouter); // for GitHub App readme links — public endpoint for fetching repo+snapshot by owner/name
// Socket.IO
io.on('connection', socket => {
  console.log('[socket] Dashboard connected:', socket.id);
  socket.on('disconnect', () => console.log('[socket] Dashboard disconnected:', socket.id));
});

const subscriber = new Redis(process.env.REDIS_URL);
subscriber.subscribe('codepulse:health-update');
subscriber.on('message', (_channel, message) => {
  const data = JSON.parse(message);
  io.emit('health-update', data);
  console.log(`[socket] health-update for repo ${data.repoId} — score ${data.healthScore?.toFixed(1)}`);
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`CodePulse API running on :${PORT}`));

export { io };
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import webhookRouter from './routes/webhook.js';
import reposRouter from './routes/repos.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

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
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/webhook', webhookRouter);
app.use('/api', reposRouter);

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
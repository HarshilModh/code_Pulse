import { Worker } from 'bullmq';
import { processComplexity } from './workers/complexity.js';
import { processDeadCode } from './workers/deadcode.js';
import { processVuln } from './workers/vuln.js';
import { processCoverage } from './workers/coverage.js';
import { processDrift } from './workers/drift.js';
import { processAggregator } from './workers/aggregator.js';
import Redis from 'ioredis';           
import dotenv from 'dotenv';

dotenv.config();

const connection = { url: process.env.REDIS_URL };

const workerConfig = { connection, concurrency: 5 };
const subscriber=new Redis(process.env.REDIS_URL);
subscriber.subscribe('codepulse:health-update');
subscriber.on('message', (channel, message) => {
  const data = JSON.parse(message);
    io.emit('health-update', data);                                                                                                                                                     
    console.log(`[socket] health-update for repo ${data.repoId} — score ${data.healthScore?.toFixed(1)}`);
  });     
const workers = [
  new Worker('complexity-queue', processComplexity, workerConfig),
  new Worker('deadcode-queue',   processDeadCode,   workerConfig),
  new Worker('vuln-queue',       processVuln,       workerConfig),
  new Worker('coverage-queue',   processCoverage,   workerConfig),
  new Worker('drift-queue',      processDrift,      workerConfig),
  new Worker('aggregator-queue', processAggregator, workerConfig),
];

// Log when each worker picks up a job
workers.forEach(worker => {
  worker.on('completed', job => {
    console.log(`[${worker.name}] Job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[${worker.name}] Job ${job?.id} failed:`, err.message);
  });
});

// Graceful shutdown — wait for active jobs to finish before exiting
async function shutdown() {
  console.log('[worker] Shutting down gracefully...');
  await Promise.all(workers.map(w => w.close()));
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[worker] All workers started');
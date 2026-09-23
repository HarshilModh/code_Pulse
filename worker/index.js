import { Worker } from 'bullmq';
import { processComplexity } from './workers/complexity.js';
import { processDeadCode } from './workers/deadcode.js';
import { processVuln } from './workers/vuln.js';
import { processCoverage } from './workers/coverage.js';
import { processDrift } from './workers/drift.js';
import { processInsights } from './workers/insights.js';
import { processAggregator } from './workers/aggregator.js';
import { processCluster } from './workers/cluster.js';
import { startDigestCron } from './digest/cron.js';
import { withRunTracking } from './lib/runLifecycle.js';
import { startSweeper, stopSweeper } from './lib/sweeper.js';
import { closeQueues } from './lib/queues.js';
import dotenv from 'dotenv';

dotenv.config();

const connection = { url: process.env.REDIS_URL };

const workerConfig = { connection, concurrency: 5 };

const workers = [
  new Worker('complexity-queue', withRunTracking('complexity', processComplexity), workerConfig),
  new Worker('deadcode-queue',   withRunTracking('deadcode', processDeadCode),   workerConfig),
  new Worker('vuln-queue',       withRunTracking('vuln', processVuln),       workerConfig),
  new Worker('coverage-queue',   withRunTracking('coverage', processCoverage),   workerConfig),
  new Worker('drift-queue',      withRunTracking('drift', processDrift),      workerConfig),
  new Worker('aggregator-queue', processAggregator, workerConfig),
  new Worker('insights-queue', processInsights, workerConfig),
  new Worker('cluster-queue', processCluster, workerConfig),
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
  stopSweeper();
  await Promise.all(workers.map(w => w.close()));
  await closeQueues();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[worker] All workers started');

// Periodic safety net for runs stuck by crashes / lost jobs (see lib/sweeper.js)
startSweeper();

// Start the weekly digest cron
startDigestCron();
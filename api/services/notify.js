import Redis from 'ioredis';

// Lazy singleton — only connects when first notification is sent
let publisher = null;
function getPublisher() {
  if (!publisher) publisher = new Redis(process.env.REDIS_URL);
  return publisher;
}

// Broadcast a health update to all connected dashboards via Socket.IO
export async function notifyHealthUpdate({ repoId, snapshotId, healthScore }) {
  await getPublisher().publish('codepulse:health-update', JSON.stringify({ repoId, snapshotId, healthScore }));
}

// Broadcast a worker lifecycle event (start / done / error) for the pipeline UI
export async function notifyWorkerEvent({ repoId, worker, phase, data = {} }) {
  await getPublisher().publish('codepulse:worker-event', JSON.stringify({ repoId, worker, phase, ...data }));
}

import { Queue } from 'bullmq';

const connection = { url: process.env.REDIS_URL };

const queues = {
  complexity: new Queue('complexity-queue', { connection }),
  deadcode:   new Queue('deadcode-queue',   { connection }),
  vuln:       new Queue('vuln-queue',       { connection }),
  coverage:   new Queue('coverage-queue',   { connection }),
  drift:      new Queue('drift-queue',      { connection }),
};

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
};

export async function fanOut(payload) {
  await Promise.all(
    Object.values(queues).map(q => q.add('analyze', payload, defaultJobOptions))
  );
  console.log(`[queue] Fanned out job for repo ${payload.repoId}`);
}

export { queues };
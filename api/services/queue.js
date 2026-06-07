import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = { url: process.env.REDIS_URL };
const redis = new Redis(process.env.REDIS_URL);

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
  await redis.del(`codepulse:results:${payload.repoId}:${payload.commitSha}`);
  await Promise.all(
    Object.values(queues).map(q => q.add('analyze', payload, defaultJobOptions))
  );
  console.log(`[queue] Fanned out job for repo ${payload.repoId}`);
}

export async function fanOutPublic(payload) {
  const publicPayload = { ...payload, source: 'public_url', installationId: null };
  await redis.del(`codepulse:results:${payload.repoId}:${payload.commitSha}`);
  await Promise.all(
    Object.values(queues).map(q => q.add('analyze', publicPayload, defaultJobOptions))
  );

  console.log(`[queue] Fanned out public job for repo ${payload.repoId}`);
}


export { queues };  
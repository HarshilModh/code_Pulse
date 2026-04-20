import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const REQUIRED_WORKERS = ['complexity', 'deadcode', 'vuln', 'coverage', 'drift'];
const TTL = 86400; // 24 hours

export const storeWorkerResult = async (repoId, commitSha, workerName, result) => {
  const key = `codepulse:results:${repoId}:${commitSha}`;
  await redis.hset(key, workerName, JSON.stringify(result));
  await redis.expire(key, TTL);

  // Check if all 5 workers are done
  const raw = await redis.hgetall(key);
  const doneWorkers = REQUIRED_WORKERS.filter(w => raw[w]);
  
  if (doneWorkers.length === REQUIRED_WORKERS.length) {
    // Parse all results
    const allResults = {};
    for (const [k, v] of Object.entries(raw)) {
      allResults[k] = JSON.parse(v);
    }
    return { complete: true, results: allResults };
  }

  console.log(`[resultStore] ${doneWorkers.length}/5 workers done for ${commitSha.slice(0,8)}`);
  return { complete: false, results: null };
};

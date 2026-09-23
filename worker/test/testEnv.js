// Where tests run. Deliberately NOT read from .env: tests get their own database and their own
// Redis DB number, so running them can never touch dev data (or, worse, Neon).
// CI overrides these with TEST_DATABASE_URL / TEST_REDIS_URL.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
  ?? 'postgresql://codepulse:codepulse@localhost:5433/codepulse_test';
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'postgres', 'redis'];

// Tests TRUNCATE tables and FLUSH Redis. Refuse unless the targets are clearly disposable:
// a local host, a database whose name ends in _test, and a non-default Redis DB number.
export function assertSafeTestTargets(dbUrl = TEST_DATABASE_URL, redisUrl = TEST_REDIS_URL) {
  const db = new URL(dbUrl);
  const redis = new URL(redisUrl);
  const dbName = db.pathname.slice(1);
  const redisDb = Number(redis.pathname.slice(1) || 0);
  if (!LOCAL_HOSTS.includes(db.hostname) || !dbName.endsWith('_test'))
    throw new Error(`Refusing to run tests against database ${db.hostname}/${dbName} — must be local and end in _test`);
  if (!LOCAL_HOSTS.includes(redis.hostname) || redisDb === 0)
    throw new Error(`Refusing to run tests against Redis ${redis.hostname} db ${redisDb} — must be local and not db 0`);
}

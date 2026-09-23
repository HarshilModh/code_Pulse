import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { TEST_DATABASE_URL, TEST_REDIS_URL, assertSafeTestTargets } from './testEnv.js';

// Runs once before all test files: check the targets are disposable, then bring the test
// database's schema up to date with the same migrations production uses.
export default function setup() {
  assertSafeTestTargets();
  const apiDir = fileURLToPath(new URL('../../api', import.meta.url));
  execSync('npx prisma migrate deploy', {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  console.log(`[test] migrated ${new URL(TEST_DATABASE_URL).pathname.slice(1)}; Redis ${TEST_REDIS_URL}`);
}

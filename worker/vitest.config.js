import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './test/testEnv.js';

export default defineConfig({
  test: {
    // Set before any test file imports api/lib/prisma.js, so Prisma connects to the test DB.
    // (dotenv and Prisma's own .env loading never override variables that are already set.)
    env: { DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL, REDIS_URL: TEST_REDIS_URL, NODE_ENV: 'test' },
    globalSetup: ['./test/globalSetup.js'],
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.js'],
    fileParallelism: false,   // all files share one database; run them one at a time
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

import { beforeAll, afterAll } from 'vitest';
import prisma from '../../api/lib/prisma.js';

// Second guard, inside each test process: ask Postgres which database we are ACTUALLY
// connected to, in case some .env file won over the config.
beforeAll(async () => {
  const [{ db }] = await prisma.$queryRaw`SELECT current_database() AS db`;
  if (!db.endsWith('_test')) throw new Error(`Connected to "${db}", not a _test database — aborting`);
});

afterAll(async () => { await prisma.$disconnect(); });

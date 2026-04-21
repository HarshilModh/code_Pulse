// Manual trigger — fires the digest immediately for testing.
// Run from worker/ with:  node digest/runNow.js
import prisma from '../../api/lib/prisma.js'
import { sendDigest } from './sendDigest.js'

const repos = await prisma.repo.findMany()
console.log(`[digest] Firing digest for ${repos.length} repo(s)...`)

for (const repo of repos) {
  try {
    await sendDigest(repo)
  } catch (err) {
    console.error(`[digest] failed for ${repo.owner}/${repo.name}:`, err.message)
  }
}

console.log('[digest] Done.')
process.exit(0)

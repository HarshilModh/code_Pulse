import cron from 'node-cron'
import { sendDigest } from './sendDigest.js'
import prisma from '../../api/lib/prisma.js'

export function startDigestCron() {
  // Every Monday at 9am
  cron.schedule('0 9 * * 1', async () => {
    console.log('[digest] Running weekly digest...')
    const repos = await prisma.repo.findMany()

    for (const repo of repos) {
      try {
        await sendDigest(repo)
      } catch (err) {
        console.error(`[digest] failed for ${repo.owner}/${repo.name}:`, err.message)
      }
    }

    console.log(`[digest] Complete — processed ${repos.length} repos`)
  })

  console.log('[digest] Cron scheduled — every Monday at 9am')
}

import cron from 'node-cron'
import { sendDigest } from './sendDigest.js'
import prisma from '../../api/lib/prisma.js'

async function runDigest(cadence) {
  const repos = await prisma.repo.findMany({
    include: { settings: true },
  })

  let count = 0
  for (const repo of repos) {
    const repoCadence = repo.settings?.digestCadence ?? 'weekly'
    if (repoCadence !== cadence) continue

    try {
      await sendDigest(repo)
      count++
    } catch (err) {
      console.error(`[digest] failed for ${repo.owner}/${repo.name}:`, err.message)
    }
  }

  console.log(`[digest] ${cadence} run complete — ${count} repo(s) processed`)
}

export function startDigestCron() {
  // Weekly — every Monday at 9am
  cron.schedule('0 9 * * 1', () => {
    console.log('[digest] Running weekly digest...')
    runDigest('weekly').catch(err => console.error('[digest] weekly run failed:', err.message))
  })

  // Daily — every day at 9am
  cron.schedule('0 9 * * *', () => {
    console.log('[digest] Running daily digest...')
    runDigest('daily').catch(err => console.error('[digest] daily run failed:', err.message))
  })

  console.log('[digest] Cron scheduled — daily @ 9am, weekly @ Mon 9am')
}

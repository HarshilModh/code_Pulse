import express from 'express'
import prisma from '../lib/prisma.js'

const router = express.Router()

// Public endpoint — no Clerk auth. Returns a shields.io-style SVG badge showing
// the latest health score for any repo. Intended to be embedded in READMEs.
// URL: GET /badge/:owner/:name.svg   (mounted at root, NOT under /api)
router.get('/badge/:owner/:name.svg', async (req, res) => {
  const { owner, name } = req.params

  // findFirst instead of findUnique because multiple users can own the same repo —
  // for badges we just want any match (public score is not sensitive data)
  const repo = await prisma.repo.findFirst({
    where: { owner, name },
    select: { id: true },
  })

  if (!repo) return res.status(404).send('Not found')

  // Latest snapshot holds the most recent health score
  const snapshot = await prisma.snapshot.findFirst({
    where: { repoId: repo.id },
    orderBy: { createdAt: 'desc' },
    select: { healthScore: true },
  })

  const score = snapshot ? Math.round(snapshot.healthScore) : null
  const label = score === null ? 'unknown' : String(score)

  // Color thresholds mirror the dashboard signal levels
  const color =
    score === null ? '6b7280'  // gray — no data yet
    : score >= 80  ? '10b981'  // emerald — healthy
    : score >= 60  ? '3b82f6'  // blue — ok
    : score >= 40  ? 'f59e0b'  // amber — needs attention
    :                'ef4444'  // red — critical

  // max-age=0 so README embeds always show the live score, not a CDN-cached one
  res.setHeader('Content-Type', 'image/svg+xml')
  res.setHeader('Cache-Control', 'no-cache, max-age=0')
  res.send(buildSvg('health', label, color))
})

// Builds a two-panel shields.io-style SVG badge.
// Left panel: dark gray label. Right panel: color-coded value.
// Character widths are approximated at 11px Verdana — close enough for display.
function buildSvg(leftText, rightText, color) {
  const lw = leftText.length * 6 + 10   // width of left (label) panel
  const rw = rightText.length * 6 + 10  // width of right (value) panel
  const totalW = lw + rw

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20">
    <linearGradient id="s" x2="0" y2="100%">
      <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${rw}" height="20" fill="#${color}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
    <g fill="#fff" font-family="Verdana,Geneva,sans-serif" font-size="11" text-anchor="middle">
      <text x="${lw / 2}" y="14" fill="#010101" fill-opacity=".3">${leftText}</text>
      <text x="${lw / 2}" y="13">${leftText}</text>
      <text x="${lw + rw / 2}" y="14" fill="#010101" fill-opacity=".3">${rightText}</text>
      <text x="${lw + rw / 2}" y="13">${rightText}</text>
    </g>
  </svg>`
}

export default router

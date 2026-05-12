import express from 'express'
import prisma from '../lib/prisma.js'
import { searchCode } from '../services/tools.js'

const router = express.Router()

// GET /api/search?q=<term>&repoId=<optional>
// Global search for the ⌘K command palette. Returns up to 5 repos, 10 findings,
// and 10 semantically similar files — all scoped to the authenticated user.
router.get('/search', async (req, res) => {
  const { q } = req.query

  // Return empty buckets for blank queries — the palette shows a blank state, not an error
  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.json({ repos: [], findings: [], files: [] })
  }

  const term = q.trim()

  // Resolve all repos this user owns upfront — needed to scope findings and file search
  const userRepos = await prisma.repo.findMany({
    where: { userId: req.userId },
    select: { id: true, owner: true, name: true },
  })
  const userRepoIds = userRepos.map(r => r.id)

  // All three searches run in parallel to keep command-palette latency low
  const [repos, findings, files] = await Promise.all([

    // 1. Repos — match against owner or name (no description field on the model)
    prisma.repo.findMany({
      where: {
        userId: req.userId,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { owner: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true, owner: true, name: true, lastAnalyzedAt: true },
      take: 5,
    }),

    // 2. Findings — open ones only, title match, scoped to this user's repos
    prisma.finding.findMany({
      where: {
        repoId: { in: userRepoIds },
        status: 'open',
        title: { contains: term, mode: 'insensitive' },
      },
      select: { id: true, repoId: true, type: true, title: true, severity: true, filePath: true },
      take: 10,
    }),

    // 3. Files — pgvector semantic search over FileAnalysis embeddings.
    // Falls back to the user's first repo when no repoId query param is provided.
    // searchCode is a tool from tools.js that runs a cosine similarity query.
    (async () => {
      const repoId = req.query.repoId ?? userRepoIds[0]
      if (!repoId) return []
      try {
        return await searchCode({ repoId, query: term, k: 10 })
      } catch (err) {
        // Don't fail the whole search if the vector query errors (e.g. no embeddings yet)
        console.error('[search] searchCode error:', err)
        return []
      }
    })(),
  ])

  res.json({ repos, findings, files })
})

export default router

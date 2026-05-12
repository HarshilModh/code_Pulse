import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Returns the k most semantically similar files using pgvector cosine distance.
// The inner subquery fetches the embedding for the target file, then we rank all other files by similarity.
router.get('/repos/:id/files/neighbors', async (req, res) => {
  const repoId = req.params.id;
  const { path, k = 5 } = req.query;

  if (!path) return res.status(400).json({ error: 'File path is required' });

  const repo = await prisma.repo.findFirst({ where: { id: repoId, userId: req.userId } });
  if (!repo) return res.status(404).json({ error: 'Repo not found' });

  const results = await prisma.$queryRaw`
    SELECT
      fa."filePath",
      fa.complexity,
      fa."isDead",
      fa."driftScore",
      1 - (fa.embedding <=> (
        SELECT embedding FROM "FileAnalysis"
        WHERE "repoId" = ${repoId} AND "filePath" = ${path}
        LIMIT 1
      )) AS similarity
    FROM "FileAnalysis" fa
    WHERE fa."repoId" = ${repoId}
      AND fa."filePath" != ${path}
      AND fa.embedding IS NOT NULL
    ORDER BY similarity DESC
    LIMIT ${parseInt(k)}
  `;

  res.json(results.map(r => ({ ...r, similarity: Number(r.similarity).toFixed(3) })));
});

router.post('/repos/:id/files/explain', async (req, res) => {
  const repoId = req.params.id;
  const { path } = req.body;

  if (!path) return res.status(400).json({ error: 'File path is required' });

  const repo = await prisma.repo.findFirst({ where: { id: repoId, userId: req.userId } });
  if (!repo) return res.status(404).json({ error: 'Repo not found' });

  // Fetch file-level metrics and top-complexity functions in parallel
  const fileAnalysis = await prisma.fileAnalysis.findFirst({
    where: { repoId, filePath: path },
    // include id so we can look up function-level metrics
    select: { id: true, complexity: true, isDead: true, driftScore: true },
  });

  const functionMetrics = fileAnalysis
    ? await prisma.functionMetric.findMany({
        where: { fileAnalysisId: fileAnalysis.id },
        orderBy: { cyclomatic: 'desc' },
        take: 10,
      })
    : [];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = d => res.write(`data: ${JSON.stringify(d)}\n\n`);

  // Send file metrics first so the client can render them immediately
  send({ type: 'fileAnalysis', data: fileAnalysis });

  const messages = [
    {
      role: 'system',
      content: `You are a senior engineer explaining a file to a new team member. Be concise and practical. Always pass repoId: "${repoId}" in tool calls.`,
    },
    {
      role: 'user',
      content: `Explain the file "${path}" in ${repo.owner}/${repo.name}.

Metrics:
- Complexity: ${fileAnalysis?.complexity ?? 'unknown'}
- Dead code: ${fileAnalysis?.isDead ? 'yes' : 'no'}
- Drift score: ${fileAnalysis?.driftScore ?? 'unknown'}
${functionMetrics.length > 0 ? `\nTop complex functions:\n${functionMetrics.map(f => `- ${f.name} (cyclomatic: ${f.cyclomatic}, lines ${f.startLine}–${f.endLine})`).join('\n')}` : ''}

Use the read_file tool to read the file. Then explain:
1. What this file does
2. Why it's complex (if it is)
3. How it connects to the rest of the codebase
4. What a new developer should know before touching it`,
    },
  ];

  try {
    // Dynamic import so a missing service doesn't break the router on startup
    const { chatStream } = await import('../services/openAI.js');
    const { openAITools } = await import('../services/tools.js');
    for await (const event of chatStream(messages, { tools: openAITools })) {
      send(event);
    }
  } catch (err) {
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

export default router;

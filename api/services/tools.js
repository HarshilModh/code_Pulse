import prisma from '../lib/prisma.js';
import { embedText } from './embed.js';

// ─── Tool implementations ────────────────────────────────────────────────────

export async function searchCode({ repoId, query, k = 6 }) {
    const vector = await embedText(query);
    const results = await prisma.$queryRaw`
        SELECT fa."filePath",
               1 - (fa.embedding <=> ${JSON.stringify(vector)}::vector) AS similarity
        FROM "FileAnalysis" fa
        WHERE fa."repoId" = ${repoId}
          AND fa.embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT ${k}
    `;
    return results.map(r => ({
        filePath: r.filePath,
        similarity: Number(r.similarity).toFixed(3),
    }));
}

export async function getMetrics({ repoId, path }) {
    if (path) {
        const fa = await prisma.fileAnalysis.findFirst({
            where: { repoId, filePath: path },
            select: { filePath: true, complexity: true, isDead: true, driftScore: true },
        });
        if (!fa) return { error: `File not found: ${path}` };
        return fa;
    }
    const latest = await prisma.snapshot.findFirst({
        where: { repoId },
        orderBy: { createdAt: 'desc' },
        select: { healthScore: true, complexity: true, vulnCount: true, deadCode: true, coverage: true, driftScore: true, commitSha: true, createdAt: true },
    });
    return latest ?? { error: 'No snapshots yet' };
}

export async function getSnapshotHistory({ repoId, limit = 10 }) {
    const snapshots = await prisma.snapshot.findMany({
        where: { repoId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, commitSha: true, healthScore: true, complexity: true, vulnCount: true, deadCode: true, coverage: true, driftScore: true, createdAt: true },
    });
    return snapshots;
}

export async function getFindings({ repoId, status }) {
    const where = { repoId };
    if (status) where.status = status;
    const findings = await prisma.finding.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        take: 30,
        select: { id: true, type: true, severity: true, filePath: true, title: true, status: true, createdAt: true },
    }).catch(() => []); // Finding model added in Phase 3 — graceful fallback
    return findings;
}

export async function readFile({ repoId, path }) {
    const repo = await prisma.repo.findUnique({ where: { id: repoId } });
    if (!repo) return { error: 'Repo not found' };
    try {
        let content;
        if (repo.source === 'github_app' && repo.installationId) {
            const { getFileContent } = await import('./octokit.js');
            content = await getFileContent(repo.installationId, repo.owner, repo.name, path, repo.defaultBranch);
        } else {
            const { getPublicFileContent } = await import('./publicOctokit.js');
            content = await getPublicFileContent(repo.owner, repo.name, path, repo.defaultBranch);
        }
        if (content === null) return { error: `File not found: ${path}` };
        return { content: content.slice(0, 8000) };
    } catch (err) {
        return { error: err.message };
    }
}

export async function getDiff({ repoId, commitSha, path }) {
    const repo = await prisma.repo.findUnique({ where: { id: repoId } });
    if (!repo) return { error: 'Repo not found' };
    try {
        let octokit;
        if (repo.source === 'github_app' && repo.installationId) {
            const { getInstallationOctokit } = await import('./octokit.js');
            octokit = await getInstallationOctokit(repo.installationId);
        } else {
            const { Octokit } = await import('@octokit/rest');
            octokit = new Octokit(process.env.GITHUB_PUBLIC_PAT ? { auth: process.env.GITHUB_PUBLIC_PAT } : {});
        }
        const { data } = await octokit.rest.repos.getCommit({ owner: repo.owner, repo: repo.name, ref: commitSha });
        const files = (data.files ?? [])
            .filter(f => !path || f.filename === path)
            .slice(0, 5)
            .map(f => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: (f.patch ?? '').slice(0, 2000) }));
        return { commitSha, message: data.commit.message, files };
    } catch (err) {
        return { error: err.message };
    }
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const tools = [
    {
        name: 'search_code',
        description: 'Semantic search across all files in a repo using embeddings. Returns the most relevant file paths.',
        parameters: {
            type: 'object',
            properties: {
                repoId: { type: 'string', description: 'The repo ID' },
                query: { type: 'string', description: 'Natural language query' },
                k: { type: 'number', description: 'Number of results (default 6)' },
            },
            required: ['repoId', 'query'],
        },
        execute: searchCode,
    },
    {
        name: 'get_metrics',
        description: 'Get health metrics for a repo or a specific file. Omit path for repo-level snapshot.',
        parameters: {
            type: 'object',
            properties: {
                repoId: { type: 'string' },
                path: { type: 'string', description: 'File path (optional)' },
            },
            required: ['repoId'],
        },
        execute: getMetrics,
    },
    {
        name: 'get_snapshot_history',
        description: 'Get the last N health snapshots for a repo, ordered newest first.',
        parameters: {
            type: 'object',
            properties: {
                repoId: { type: 'string' },
                limit: { type: 'number', description: 'Max snapshots to return (default 10)' },
            },
            required: ['repoId'],
        },
        execute: getSnapshotHistory,
    },
    {
        name: 'get_findings',
        description: 'Get open findings (bugs, drift, vulns, dead code) for a repo.',
        parameters: {
            type: 'object',
            properties: {
                repoId: { type: 'string' },
                status: { type: 'string', enum: ['open', 'acknowledged', 'resolved', 'dismissed', 'snoozed', 'wont_fix'] },
            },
            required: ['repoId'],
        },
        execute: getFindings,
    },
    {
        name: 'read_file',
        description: 'Read the contents of a specific file from the repo.',
        parameters: {
            type: 'object',
            properties: {
                repoId: { type: 'string' },
                path: { type: 'string', description: 'File path relative to repo root' },
            },
            required: ['repoId', 'path'],
        },
        execute: readFile,
    },
    {
        name: 'get_diff',
        description: 'Get the file changes (patch) for a specific commit SHA.',
        parameters: {
            type: 'object',
            properties: {
                repoId: { type: 'string' },
                commitSha: { type: 'string' },
                path: { type: 'string', description: 'Optional: filter to a specific file path' },
            },
            required: ['repoId', 'commitSha'],
        },
        execute: getDiff,
    },
];

// OpenAI function-calling format
export const openAITools = tools.map(t => ({
    type: 'function',
    function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
    },
}));

// MCP tool-spec format (Phase 6)
export const mcpTools = tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.parameters,
}));

// Execute a tool by name
export async function executeTool(name, args) {
    const tool = tools.find(t => t.name === name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.execute(args);
}

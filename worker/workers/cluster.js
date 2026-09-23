import prisma from '../../api/lib/prisma.js';
import OpenAI from 'openai';
import { kmeans } from 'ml-kmeans';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MIN_FILES = 20;
const K = 4;
const SAMPLE_SIZE = 5;

async function labelCluster(filePaths) {
    const sample = filePaths.slice(0, SAMPLE_SIZE).join('\n');
    const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
            role: 'user',
            content: `These files belong to the same architectural cluster:\n${sample}\n\nReply with JSON: {"label":"short name (2-4 words)","summary":"one sentence describing this module's purpose"}`,
        }],
        response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(res.choices[0].message.content);
    return { label: parsed.label ?? 'Unnamed', summary: parsed.summary ?? '' };
}

export const processCluster = async (job) => {
    const { repoId, snapshotId, commitSha } = job.data;
    try {
        console.log(`[cluster] Processing repoId: ${repoId}, snapshotId: ${snapshotId}, commitSha: ${commitSha}`);

        const rows = await prisma.$queryRaw`
            SELECT id, "filePath", embedding::text AS embedding_text
            FROM "FileAnalysis"
            WHERE "repoId" = ${repoId} AND embedding IS NOT NULL
        `;

        if (rows.length < MIN_FILES) {
            console.log(`[cluster] Skipping — only ${rows.length} embedded files`);
            return { skipped: true };
        }

        const vectors   = rows.map(r => JSON.parse(r.embedding_text));
        const fileIds   = rows.map(r => r.id);
        const filePaths = rows.map(r => r.filePath);

        const { clusters: assignments, centroids } = kmeans(vectors, K, {
            initialization: 'kmeans++',
            maxIterations: 100,
        });

        const groups = Array.from({ length: K }, () => []);
        assignments.forEach((clusterIdx, fileIdx) => {
            groups[clusterIdx].push({ id: fileIds[fileIdx], filePath: filePaths[fileIdx] });
        });

        await prisma.cluster.deleteMany({ where: { repoId } });

        for (let i = 0; i < K; i++) {
            const members = groups[i];
            if (members.length === 0) continue;

            const { label, summary } = await labelCluster(members.map(m => m.filePath));

            const cluster = await prisma.cluster.create({
                data: { repoId, snapshotId, label, summary, fileCount: members.length },
            });

            await prisma.$executeRaw`
                UPDATE "Cluster"
                SET centroid = ${JSON.stringify(centroids[i])}::vector
                WHERE id = ${cluster.id}
            `;

            await prisma.fileAnalysis.updateMany({
                where: { id: { in: members.map(m => m.id) } },
                data: { clusterId: cluster.id },
            });
        }

        await prisma.repo.update({
            where: { id: repoId },
            data: { lastClusteredCommit: commitSha },
        });

        console.log(`[cluster] Created ${K} clusters for repo ${repoId}`);
        return { clustersCreated: K };
    } catch (err) {
        console.error('[cluster] Fatal error:', err.message);
        throw err;
    }
};

import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// GET /api/repos/:id/clusters — fetch clusters + cross-cluster edges for the map
router.get('/repos/:id/clusters', async (req, res) => {
    try {
        const { id: repoId } = req.params;

        const clusters = await prisma.cluster.findMany({
            where: { repoId },
            orderBy: { fileCount: 'desc' },
            include: {
                members: {
                    select: { id: true, filePath: true, complexity: true, driftScore: true, isDead: true },
                },
            },
        });

        if (clusters.length === 0) {
            return res.json({ clusters: [], edges: [] });
        }

        // Build cross-cluster edges via shared drift neighbors
        // Two clusters are linked if any member of one has a driftScore neighbor in the other
        const edges = [];
        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                const sharedFiles = clusters[i].members.filter(a =>
                    clusters[j].members.some(b => Math.abs((a.driftScore ?? 0) - (b.driftScore ?? 0)) < 0.1)
                );
                if (sharedFiles.length > 0) {
                    edges.push({
                        source: clusters[i].id,
                        target: clusters[j].id,
                        weight: sharedFiles.length,
                    });
                }
            }
        }

        res.json({ clusters, edges });
    } catch (err) {
        console.error('[clusters] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch clusters' });
    }
});

export default router;

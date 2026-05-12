import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

router.get('/:snapshotId/insights', async (req, res) => {
    const { snapshotId } = req.params;
    try {
        const insight = await prisma.insight.findUnique({
            where: { snapshotId: snapshotId },
            select: { topRisks: true, improvements: true, nextAction: true, model: true }
        });
        if (!insight) {
            return res.status(202).json({ pending: true });
        }
        res.json(insight);
    } catch (error) {
        console.error('Error fetching insight:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
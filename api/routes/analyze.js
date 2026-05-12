import express from "express";
import prisma from "../lib/prisma.js";
import { getPublicHeadSha, getPublicRepoTree } from '../services/publicOctokit.js';
import { fanOutPublic } from '../services/queue.js';
import { Octokit } from '@octokit/rest';                                                                                                                                              
const octokit = new Octokit(process.env.GITHUB_PUBLIC_PAT ? { auth: process.env.GITHUB_PUBLIC_PAT } : {});     


const router = express.Router();

router.post('/analyze', async (req, res) => {
    const { repoUrl } = req.body;
    if (!repoUrl) {
        return res.status(400).json({ error: 'Missing repoUrl' });
    }
    // Parse owner/repo from GitHub URL                                                                                                                                                 
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/?#\s]+?)(?:\.git)?(?:[/?#]|$)/);
    if (!match) return res.status(400).json({ error: 'Invalid GitHub URL' });
    const [, owner, repoName] = match;  
    try {
        const { sha, defaultBranch } = await getPublicHeadSha(owner, repoName);

        // Upsert user (Clerk userId already on req from requireClerk)                                                                                                                    
        await prisma.user.upsert({
            where: { id: req.userId },
            update: {},
            create: { id: req.userId, email: `${req.userId}@unknown.com` },
        });

        // Fetch file tree, cap at 200 files                                                                                                                                              
        const allPaths = await getPublicRepoTree(owner, repoName, sha);
        const changedFiles = allPaths.slice(0, 200);

        // Get numeric GitHub repo ID
        const {data:ghRepo} = await octokit.repos.get({ owner, repo: repoName });
        
        // Upsert repo row                                                                                                                                                                
        const repo = await prisma.repo.upsert({
            where: { userId_githubRepoId: { userId: req.userId, githubRepoId: ghRepo.id } },
            update: { lastAnalyzedAt: new Date() },
            create: {
                userId: req.userId,
                githubRepoId: ghRepo.id,
                owner,
                name: repoName,
                source: 'public_url',
                defaultBranch,
                lastAnalyzedAt: new Date(),
            },
        });

        // Fan out to all 5 workers
        await fanOutPublic({
            repoId: repo.id,
            owner,
            repoName,
            commitSha: sha,
            ref: sha,
            changedFiles,
        });

        res.json({ repoId: repo.id, commitSha: sha });
    } catch (err) {
        console.error('[analyze]', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
import express from 'express';
import prisma from '../lib/prisma.js';
import { getInstallationOctokit } from '../services/octokit.js';
import { fanOut } from '../services/queue.js';


const router = express.Router();

router.get("/callback", async (req,res)=>{
   const {installation_id,state:userId}=req.query
   if(!installation_id){
    return res.status(400).send("missing")
   }

   try{
  const oct = await getInstallationOctokit(Number(installation_id));
  const { data } = await oct.rest.apps.listReposAccessibleToInstallation({ per_page: 100 });

  const githubLogin = data.repositories[0]?.owner.login ?? null;

  // Ensure the User row exists before we try to create Repos with it as FK
  if (userId) {
    await prisma.user.upsert({
      where: { id: userId },
      update: { ...(githubLogin && { githubLogin }) },
      create: { id: userId, email: `${userId}@clerk.placeholder`, githubLogin: githubLogin ?? undefined },
    });
  }

  console.log(`[install] userId=${userId} githubLogin=${githubLogin} repos=${data.repositories.length}`);

  for (const ghRepo of data.repositories) {
    const repo = await prisma.repo.upsert({
      where: { userId_githubRepoId: { userId, githubRepoId: ghRepo.id } },
      update: { installationId: Number(installation_id), source: 'github_app' },
      create: {
        userId,
        githubRepoId: ghRepo.id,
        owner: ghRepo.owner.login,
        name: ghRepo.name,
        installationId: Number(installation_id),
        source: 'github_app',
        defaultBranch: ghRepo.default_branch,
      },
    });

    // Fetch the latest commit SHA on the default branch and kick off analysis immediately
    try {
      const { data: branchData } = await oct.rest.repos.getBranch({
        owner: ghRepo.owner.login,
        repo: ghRepo.name,
        branch: ghRepo.default_branch,
      });
      const commitSha = branchData.commit.sha;
      const ref = `refs/heads/${ghRepo.default_branch}`;

      await fanOut({
        repoId: repo.id,
        owner: ghRepo.owner.login,
        repoName: ghRepo.name,
        installationId: Number(installation_id),
        source: 'github_app',
        commitSha,
        ref,
        changedFiles: [],
      });
      console.log(`[install] kicked off analysis for ${ghRepo.full_name} @ ${commitSha.slice(0, 8)}`);
    } catch (err) {
      console.error(`[install] failed to kick off analysis for ${ghRepo.full_name}:`, err.message);
    }
  }
  res.redirect(`${process.env.FRONTEND_URL}/dashboard`);  
   }catch(err){
    console.log(err)
    res.status(500).send("error installing")
   }
   
})

export default router;

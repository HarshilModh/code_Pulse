import express from 'express';
import prisma from '../lib/prisma.js';
import {Octokit} from '@octokit/rest';
import { getInstallationOctokit } from '../services/octokit.js';


const router = express.Router();

router.get("/install/callback", async (req,res)=>{
   const {installation_id,state:userId}=req.query
   if(!installation_id){
    return res.status(400).send("missing")
   }

   try{
  const oct = await getInstallationOctokit(Number(installation_id));
  const { data } = await oct.rest.apps.listReposAccessibleToInstallation({ per_page: 100 });

  // Stamp githubLogin on the user so webhook can find them by GitHub username
  const githubLogin = data.repositories[0]?.owner.login ?? null;
  if (userId && githubLogin) {
    await prisma.user.update({
      where: { id: userId },
      data: { githubLogin },
    }).catch(() => {}); // user may not exist yet — fine, webhook falls back to system
  }

  for (const ghRepo of data.repositories) {
    await prisma.repo.upsert({
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
  }
  res.redirect(`${process.env.FRONTEND_URL}/dashboard`);  
   }catch(err){
    console.log(err)
    res.status(500).send("error installing")
   }
   
})

export default router;

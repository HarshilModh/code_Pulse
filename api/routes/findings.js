import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.get("/findings", async (req, res) => {
    const {status,severity,type,repoId}=req.query;
    try{
        const userRepos=await prisma.repo.findMany({
            where:{
                userId:req.userId,
            },
            select:{
                id:true
            }
        });
        const userRepoIds=userRepos.map((repo)=>repo.id);
        const where = {
            repoId: { in: userRepoIds },
        }
        if (repoId) where.repoId = repoId
        if (status) where.status = status
        if (type) where.type = type
        if (severity) where.severity = severity
        const findings = await prisma.finding.findMany({
            where,
            orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
            take: 100,
            include: {
                repo: { select: { owner: true, name: true } },
                comments: { orderBy: { createdAt: 'asc' } },
            },
        });
        res.json(findings);
    }catch(error){
        res.status(500).json({error:error.message});
    }

});

router.patch("/findings/:id",async (req,res)=>{
    const{status,dismissReason,snoozedUntil}=req.body;
    const findings=await prisma.finding.findUnique({
        where:{id:req.params.id},
        include:{repo:{select:{userId:true}}}
    });
    if(!findings||findings.repo.userId!==req.userId){
        return res.status(403).json({error:"Access denied"});
    }
    const updated=await prisma.finding.update({
        where:{id:req.params.id},
        data:{
            ...(status && { status }),
            ...(dismissReason && { dismissReason }),
            ...(snoozedUntil && { snoozedUntil: new Date(snoozedUntil) }),
        }
    });
    res.json(updated);
})
router.post("/findings/:id/comments",async(req,res)=>{
    const {body}=req.body;
    if(!body||body.trim()===""){
        return res.status(400).json({error:"Comment body is required"});
    }
    const finding=await prisma.finding.findUnique({
        where:{id:req.params.id},
        include:{repo:{select:{userId:true}}}
    });
    if(!finding||finding.repo.userId!==req.userId){
        return res.status(403).json({error:"Access denied"});
    }
    const comment=await prisma.findingComment.create({
        data:{
            findingId:req.params.id,
            userId:req.userId,
            body,
        }
    });
    res.json(comment);
})

export default router;
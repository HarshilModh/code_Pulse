import prisma from '../../api/lib/prisma.js';
import Redis from 'ioredis';

const redis=new Redis(process.env.REDIS_URL);


export const processAggregator = async (job) => {
    const {repoId,commitSha,owner,repoName,results}=job.data;
    try {
        const {complexity,vuln,deadcode,coverage,drift}=results;
        const complexityPenalty= Math.min((complexity.avgComplexity / 10) * 100, 100);     
        const vulnPenalty       = Math.min((vuln.critical ?? 0) * 10 + (vuln.high ?? 0) * 5 + (vuln.moderate ?? 0) * 2, 100);                                                                 
        const deadcodePenalty   = (deadcode.deadCodeRatio ?? 0) * 100;                                                                                                                        
        const coveragePenalty   = (1 - (coverage.coverage ?? 0)) * 100;                                                                                                                       
        const driftPenalty      = (drift.driftRatio ?? 0) * 100;        
        
        const healthScore= Math.max(0, Math.min(100, 100 - (complexityPenalty * 0.25) - (vulnPenalty * 0.25) - (deadcodePenalty * 0.15) - (coveragePenalty * 0.20) - (driftPenalty * 0.15)));             

   const snapshot = await prisma.snapshot.create({                                                                                                                                       
    data: {                                                 
      repoId,
      commitSha,                                                                                                                                                                        
      healthScore,
      complexity: complexity.avgComplexity ?? 0,                                                                                                                                        
      vulnCount:  vuln.total ?? 0,                          
      deadCode:   deadcode.deadCodeRatio ?? 0,                                                                                                                                          
      coverage:   coverage.coverage ?? 0,
      driftScore: drift.driftRatio ?? 0,                                                                                                                                                
    },                                                                                                                                                                                  
  });
  console.log(`[aggregator] HealthScore: ${healthScore.toFixed(1)} — snapshot ${snapshot.id}`);                                                                                               
    await redis.publish('codepulse:health-update', JSON.stringify({
        repoId,                                                                                                                                                                             
        commitSha,
        snapshotId: snapshot.id,                                                                                                                                                            
        healthScore,                                            
        complexity:  complexity.avgComplexity ?? 0,
        vulnCount:   vuln.total ?? 0,
        deadCode:    deadcode.deadCodeRatio ?? 0,                                                                                                                                           
        coverage:    coverage.coverage ?? 0,
        driftScore:  drift.driftRatio ?? 0,                                                                                                                                                 
    }));  
    return {healthScore,snapshotId:snapshot.id}                                                   
    } catch (error) {
      console.log(error);
      throw error;
    }
}
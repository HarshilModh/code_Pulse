import {Queue} from 'bullmq';
import prisma from '../../api/lib/prisma.js';
import Redis from 'ioredis';
import { postPRComment } from '../../api/services/prComment.js'
const redis=new Redis(process.env.REDIS_URL);
const insightsQueue=new Queue('insights-queue',{connection:redis});


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

  await insightsQueue.add('insights', { snapshotId: snapshot.id });
  // Emit findings — deduplicated by (repoId, type, filePath) so re-runs don't create duplicates                                           
  await emitFindings({ repoId, results, snapshot });
  // Post or update a PR comment if this snapshot is associated with a PR — only for GitHub App repos
  await postPrComment({ repoId, snapShot: snapshot.id }).catch(err => {
    console.error('[aggregator] Error posting PR comment:', err.message);
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
      console.error('[aggregator] Fatal error:', error.message);
      throw error;
    }
}
// Emit deduplicated Finding rows after each snapshot                                                                                        
  // Cap to top 20 per type per run to avoid flooding the findings table
async function emitFindings({ repoId, results, snapshot }) {                                                                                 
    const { complexity, vuln, deadcode, drift } = results;  
    const findings = [];                                                                                                                       
                                                            
    // Vuln findings — critical and high only                                                                                                  
    if (vuln.vulnerabilities?.length) {                     
      for (const v of vuln.vulnerabilities.slice(0, 20)) {                                                                                     
        if (v.severity !== 'critical' && v.severity !== 'high') continue;
        findings.push({                                                                                                                        
          repoId,                                           
          type: 'vuln',                                                                                                                        
          severity: v.severity,                             
          filePath: null,   // vulns are package-level, not file-level
          title: `${v.severity.toUpperCase()}: ${v.name}`,                                                                                     
          body: v.via?.join(', ') ?? v.name,                                                                                                   
        });                                                                                                                                    
      }                                                                                                                                        
    }                                                       
                                                                                                                                               
    // High-complexity file findings                        
    if (complexity.files?.length) {
      for (const f of complexity.files.slice(0, 20)) {
        if (f.avgComplexity < 10) continue;   // only flag genuinely complex files                                                             
        findings.push({                                                                                                                        
          repoId,                                                                                                                              
          type: 'complexity',                                                                                                                  
          severity: f.avgComplexity >= 20 ? 'high' : 'medium',
          filePath: f.filePath,                                                                                                                
          title: `High complexity in ${f.filePath}`,
          body: `Average cyclomatic complexity: ${f.avgComplexity.toFixed(1)}`,                                                                
        });                                                                                                                                    
      }
    }                                                                                                                                          
                                                            
    // Drift findings — files that have diverged architecturally                                                                               
    if (drift.flaggedFiles?.length) {
      for (const f of drift.flaggedFiles.slice(0, 20)) {                                                                                       
        findings.push({                                                                                                                        
          repoId,
          type: 'drift',                                                                                                                       
          severity: 'medium',                               
          filePath: f.filePath,
          title: `Architectural drift in ${f.filePath}`,
          // driftScore < threshold means the file no longer fits its architectural neighborhood                                               
          body: `Drift score ${f.driftScore.toFixed(3)} is below the threshold — file may have diverged from its module.`,                     
        });                                                                                                                                    
      }                                                                                                                                        
    }                                                                                                                                          
                                                            
    // Dead code findings                                                                                                                      
    if (deadcode.deadFiles?.length) {                       
      for (const f of deadcode.deadFiles.slice(0, 20)) {
        findings.push({
          repoId,
          type: 'dead_code',
          severity: 'low',                                                                                                                     
          filePath: f.filePath,
          title: `Dead code in ${f.filePath}`,                                                                                                 
          body: `All exports in this file appear unused.`,  
        });                                                                                                                                    
      }
    }                                                                                                                                          
                                                            
    // Upsert each finding by (repoId, type, filePath) — re-runs update the body but don't create duplicates                                   
    for (const f of findings) {
      await prisma.finding.upsert({                                                                                                            
        where: {                                            
          // composite unique needed — add @@unique([repoId, type, filePath]) to schema if not present
          repoId_type_filePath: { repoId: f.repoId, type: f.type, filePath: f.filePath ?? '' },                                                
        },                                                                                                                                     
        create: { ...f, status: 'open' },                                                                                                      
        update: { title: f.title, body: f.body },   // keep existing status/assignee on re-run                                                 
      });                                                                                                                                      
    }
  }    
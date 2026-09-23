import {Queue} from 'bullmq';
import prisma from '../../api/lib/prisma.js';
import Redis from 'ioredis';
import { postPRComment } from '../../api/services/prComment.js'
import { markRunSucceeded, markRunFailed, isFinalAttempt, loadCategoryResults, claimPrComment, upsertRunSnapshot } from '../lib/runLifecycle.js';
import { CATEGORIES } from '../lib/queues.js';
import { computeHealthScore } from '../lib/healthScore.js';
const redis=new Redis(process.env.REDIS_URL);
const insightsQueue=new Queue('insights-queue',{connection:redis});


export const processAggregator = async (job) => {
    // The job carries only runId; everything else is read from Postgres. That's what lets the
    // sweeper re-enqueue aggregation knowing nothing but the run's id.
    const { runId } = job.data;
    try {
        const run = await prisma.analysisRun.findUnique({ where: { id: runId }, select: { repoId: true, commitSha: true, status: true } });
        if (!run) return { skipped: 'run not found' };
        if (run.status === 'FAILED') return { skipped: 'run already FAILED' };
        const { repoId, commitSha } = run;

        const rows = await loadCategoryResults(runId);
        const missing = CATEGORIES.filter(c => !rows[c]);
        // The handoff only advances a run once all five rows exist, so this means a bug:
        // throw so BullMQ retries and, on the last attempt, the run is marked FAILED.
        if (missing.length) throw new Error(`missing category results: ${missing.join(', ')}`);

        // A category that failed permanently ends the run as FAILED (no snapshot) instead of
        // leaving it waiting forever. Deterministic, so no point throwing to retry.
        const failed = CATEGORIES.filter(c => rows[c].status === 'FAILED');
        if (failed.length) {
            await markRunFailed(runId, `categories failed: ${failed.map(c => `${c} (${rows[c].error})`).join('; ')}`);
            return { failedCategories: failed };
        }
        const results = Object.fromEntries(CATEGORIES.map(c => [c, rows[c].report]));
        const {complexity,vuln,deadcode,coverage,drift}=results;
        const healthScore = computeHealthScore(results);
        await redis.publish('codepulse:worker-event', JSON.stringify({
            repoId,
            commitSha,
            worker: 'aggregator',
            phase: 'calculating',
            healthScore,
        }));
        const snapshotData = {
        repoId,
        commitSha,                                                                                                                                                                        
        healthScore,
        complexity: complexity.avgComplexity ?? 0,                                                                                                                                        
      vulnCount:  vuln.total ?? 0,                          
      deadCode:   deadcode.deadCodeRatio ?? 0,                                                                                                                                          
      coverage:   coverage.coverage ?? -1,
      driftScore: drift.driftRatio ?? 0,
    };
  // Keyed on the run: a second aggregation of the same run gets the existing snapshot back,
  // so every later step (insights, cluster, findings) sees the same snapshot.id.
  const snapshot = await upsertRunSnapshot(runId, snapshotData);

  // jobId = snapshot.id: a re-run aggregation re-adds the same id, which BullMQ ignores
  await insightsQueue.add('insights', { snapshotId: snapshot.id }, { jobId: snapshot.id });
  const [{count:embeddedCount}]=await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM "FileAnalysis"
      WHERE "repoId" = ${repoId} AND embedding IS NOT NULL
  `;

  if(embeddedCount >= 20){ 
      const clusterQueue = new Queue('cluster-queue', { connection: { url: process.env.REDIS_URL } });
      await clusterQueue.add('cluster', { repoId, snapshotId: snapshot.id, commitSha }, { jobId: snapshot.id });
      console.log(`[aggregator] Enqueued cluster job — ${embeddedCount} embedded files`);
  }
  // Emit findings — deduplicated by (repoId, type, filePath) so re-runs don't create duplicates                                           
  await emitFindings({ repoId, results, snapshot });
  // Post PR comment only if the user has enabled it via the integrations toggle
  const settings = await prisma.repoSettings.findUnique({ where: { repoId } });
  const prEnabled = (settings?.alertRules ?? []).some(r => r.type === 'pr_comments' && r.enabled);
  // Comments are visible to humans, so they get an at-most-once claim (see claimPrComment)
  if (prEnabled && await claimPrComment(runId)) {
    await postPRComment({ repoId, snapshotId: snapshot.id }).catch(err => {
      console.error('[aggregator] Error posting PR comment:', err.message);
    });
  }
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
    await redis.publish('codepulse:worker-event', JSON.stringify({
        repoId,
        commitSha,
        worker: 'aggregator',
        phase: 'done',
        healthScore,
    }));
    await markRunSucceeded(runId);
    return {healthScore,snapshotId:snapshot.id}                                                   
    } catch (error) {
      console.error('[aggregator] Fatal error:', error.message);
      // Earlier attempts will be retried by BullMQ; only the last one ends the run
      if (isFinalAttempt(job)) await markRunFailed(runId, error.message).catch(e => console.error('[aggregator] could not mark run FAILED:', e.message));
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
        const fc = f.complexity ?? f.avgComplexity ?? 0;
        if (fc < 10) continue;
        findings.push({
          repoId,
          type: 'complexity',
          severity: fc >= 20 ? 'high' : 'medium',
          filePath: f.filePath,
          title: `High complexity in ${f.filePath}`,
          body: `Cyclomatic complexity: ${fc.toFixed(1)}`,                                                                
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
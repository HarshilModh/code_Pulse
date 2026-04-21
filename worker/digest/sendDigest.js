                                                           
  import { Resend } from 'resend'
  import prisma from '../../api/lib/prisma.js'
                                                                                                                                                         
  const resend = new Resend(process.env.RESEND_API_KEY)
                                                                                                                                                         
  export async function sendDigest(repo) {                  
    // 1. Get snapshots from last 7 days
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)                                                                                         
    const snapshots = await prisma.snapshot.findMany({
      where: { repoId: repo.id, createdAt: { gte: since } },                                                                                             
      orderBy: { createdAt: 'asc' },                                                                                                                     
    })
                                                                                                                                                         
    // 2. Skip if no activity                                                                                                                            
    if (snapshots.length === 0) {
      console.log(`[digest] ${repo.name} — no activity this week, skipping`)                                                                             
      return                                                                                                                                             
    }
                                                                                                                                                         
    // 3. Calculate summary                                 
    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]
    const delta = last.healthScore - first.healthScore                                                                                                   
   
    // 4. Get drift outliers                                                                                                                             
    const driftFiles = await prisma.fileAnalysis.findMany({ 
      where: { repoId: repo.id, driftScore: { lt: 0.72 } },                                                                                              
      orderBy: { driftScore: 'asc' },                                                                                                                    
      take: 5,
    })                                                                                                                                                   
                                                            
    // 5. Build HTML
    const html = buildHtml({ repo, first, last, delta, snapshots, driftFiles })
                                                                                                                                                         
    // 6. Send email
    await resend.emails.send({                                                                                                                           
      from: process.env.DIGEST_FROM_EMAIL,                  
      to: process.env.DIGEST_TO_EMAIL,                                                                                                                   
      subject: `CodePulse weekly · ${repo.owner}/${repo.name} — ${last.healthScore.toFixed(1)}`,
      html,                                                                                                                                              
    })                                                      
                                                                                                                                                         
    // 7. Log it                                                                                                                                         
    await prisma.digestLog.create({
      data: {                                                                                                                                            
        repoId: repo.id,                                    
        summary: {
          commits: snapshots.length,                                                                                                                     
          healthScoreStart: first.healthScore,
          healthScoreEnd: last.healthScore,                                                                                                              
          delta,                                                                                                                                         
          driftOutliers: driftFiles.length,
        },                                                                                                                                               
      },                                                    
    })

    console.log(`[digest] ${repo.name} — sent (score: ${last.healthScore.toFixed(1)}, ${snapshots.length} commits)`)                                     
  }
                                                                                                                                                         
  function buildHtml({ repo, first, last, delta, snapshots, driftFiles }) {                                                                              
    const trend = delta > 0 ? '📈' : delta < 0 ? '📉' : '→'
    const color = delta >= 0 ? '#10b981' : '#ef4444'                                                                                                     
                                                            
    return `                                                                                                                                             
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e4e4e7; padding: 32px;">
        <h1 style="color: #fff; font-size: 20px; margin: 0 0 8px;">CodePulse Weekly</h1>                                                                 
        <p style="color: #71717a; margin: 0 0 24px; font-size: 14px;">${repo.owner}/${repo.name}</p>                                                     
                                                                                                                                                         
        <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">                           
          <div style="color: #71717a; font-size: 12px;">Health Score</div>                                                                               
          <div style="font-size: 36px; font-weight: 700; color: #3b82f6; margin: 4px 0;">${last.healthScore.toFixed(1)}</div>                            
          <div style="color: ${color}; font-size: 13px;">${trend} ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} this week</div>                            
        </div>                                                                                                                                           
                                                                                                                                                         
        <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">                           
          <div style="color: #fff; font-size: 14px; font-weight: 600; margin-bottom: 8px;">This Week</div>                                               
          <div style="color: #a1a1aa; font-size: 13px;">${snapshots.length} commits analyzed</div>                                                       
        </div>                                                                                                                                           
                                                                                                                                                         
        ${driftFiles.length > 0 ? `                                                                                                                      
          <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px;">
            <div style="color: #fff; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Drift Outliers</div>                                       
            ${driftFiles.map(f => `                                                                                                                      
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #27272a; font-size: 13px;">            
                <span style="color: #a1a1aa;">${f.filePath}</span>                                                                                       
                <span style="color: #ef4444;">${f.driftScore?.toFixed(3)}</span>
              </div>                                                                                                                                     
            `).join('')}                                    
          </div>                                                                                                                                         
        ` : ''}                                             
      </div>                                                                                                                                             
    `
  
  }

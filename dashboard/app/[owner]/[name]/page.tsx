'use client'
                                                                                                                                                                                        
  import { use } from 'react'                               
  import { useQuery } from '@tanstack/react-query'
  import { getPublicRepo } from '@/lib/api'
  import Link from 'next/link'
  import { Zap, ShieldAlert, TestTube2, Ghost, Radar, ArrowUpRight, ExternalLink } from 'lucide-react'                                                                                  
   
  export default function PublicRepoPage({                                                                                                                                              
    params,                                                 
  }: {
    params: Promise<{ owner: string; name: string }>
  }) {                                                                                                                                                                                  
    const { owner, name } = use(params)
                                                                                                                                                                                        
    const { data, isLoading, isError } = useQuery({         
      queryKey: ['public-repo', owner, name],
      queryFn: () => getPublicRepo(owner, name),
    })                                                                                                                                                                                  
   
    if (isLoading) {                                                                                                                                                                    
      return (                                              
        <div className="flex justify-center py-32">
          <div className="w-5 h-5 border border-[var(--rule-strong)] border-t-[var(--ink)] rounded-full animate-spin" />
        </div>                                                                                                                                                                          
      )
    }                                                                                                                                                                                   
                                                            
    if (isError || !data)  {
      return (
        <div className="max-w-md mx-auto text-center py-32 px-6">
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-4">404</div>                                                                      
          <h1 className="font-display text-4xl text-[var(--ink)] tracking-tighter font-medium mb-3">
            Repo not found                                                                                                                                                              
          </h1>                                             
          <p className="text-sm text-[var(--ink-muted)] mb-8">                                                                                                                          
            {owner}/{name} hasn&apos;t been analyzed yet.                                                                                                                               
          </p>
          <Link                                                                                                                                                                         
            href="/"                                        
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white rounded-full px-5 py-2.5 hover:brightness-110 transition-all"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}                                                                                             
          >
            Analyze it now <ArrowUpRight className="w-3.5 h-3.5" />                                                                                                                     
          </Link>                                                                                                                                                                       
        </div>
      )                                                                                                                                                                                 
    }                                                       

    const { repo, snapshot } = data

    const scoreColor =
      !snapshot                    ? 'var(--ink-muted)'
      : snapshot.healthScore >= 80 ? 'var(--brand)'                                                                                                                                     
      : snapshot.healthScore >= 60 ? '#3b82f6'
      : snapshot.healthScore >= 40 ? 'var(--signal-complexity)'                                                                                                                         
      :                               'var(--signal-vuln)'                                                                                                                              
   
    const scoreLabel =                                                                                                                                                                  
      !snapshot                    ? 'No data'              
      : snapshot.healthScore >= 80 ? 'Healthy'
      : snapshot.healthScore >= 60 ? 'OK'
      : snapshot.healthScore >= 40 ? 'Needs attention'                                                                                                                                  
      :                               'Critical'
                                                                                                                                                                                        
    const metrics = snapshot ? [                            
      { label: 'Complexity',      value: snapshot.complexity.toFixed(1),              hint: 'avg cyclomatic',    icon: Zap,         color: 'var(--signal-complexity)', bg:
  'var(--signal-complexity-bg)' },                                                                                                                                                      
      { label: 'Vulnerabilities', value: String(snapshot.vulnCount),                  hint: 'critical / high',   icon: ShieldAlert, color: 'var(--signal-vuln)',       bg:
  'var(--signal-vuln-bg)' },                                                                                                                                                            
      { label: 'Coverage',        value: `${(snapshot.coverage * 100).toFixed(1)}%`,  hint: 'lcov parsed',       icon: TestTube2,   color: 'var(--signal-coverage)',   bg:
  'var(--signal-coverage-bg)' },                                                                                                                                                        
      { label: 'Dead code',       value: `${(snapshot.deadCode * 100).toFixed(1)}%`,  hint: 'unused exports',    icon: Ghost,       color: 'var(--signal-dead)',       bg:
  'var(--signal-dead-bg)' },                                                                                                                                                            
      { label: 'Drift',           value: snapshot.driftScore.toFixed(2),              hint: 'cosine similarity', icon: Radar,       color: 'var(--signal-drift)',      bg:
  'var(--signal-drift-bg)' },                                                                                                                                                           
    ] : []                                                  
                                                                                                                                                                                        
    const lastAnalyzed = repo.lastAnalyzedAt                
      ? new Date(repo.lastAnalyzedAt).toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric',
        })                                                                                                                                                                              
      : 'Never'
                                                                                                                                                                                        
    return (                                                
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-16 w-full">
                                                                                                                                                                                        
        {/* Header */}
        <div className="mb-12">                                                                                                                                                         
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">
            — Public report
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-[var(--ink)] tracking-tighter font-medium mb-4">                                                                        
            <span className="text-[var(--ink-muted)]">{owner}/</span>{name}
          </h1>                                                                                                                                                                         
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-tech text-[12px] text-[var(--ink-muted)]">                                                                                                            
              Last analyzed {lastAnalyzed}                  
            </span>                                                                                                                                                                     
            {snapshot && (
              <span className="font-tech text-[11px] text-[var(--ink-subtle)]">                                                                                                         
                {snapshot.commitSha.slice(0, 7)}            
              </span>
            )}
            <a
              href={`https://github.com/${owner}/${name}`}                                                                                                                              
              target="_blank"
              rel="noopener noreferrer"                                                                                                                                                 
              className="inline-flex items-center gap-1 font-tech text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
            >                                                                                                                                                                           
              View on GitHub <ExternalLink className="w-3 h-3" />
            </a>                                                                                                                                                                        
          </div>                                            
        </div>

        {/* Score */}                                                                                                                                                                   
        {snapshot ? (
          <div className="card p-8 mb-4 flex items-center gap-10 flex-wrap">                                                                                                            
            <div>                                           
              <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-2">
                Health Score                                                                                                                                                            
              </div>
              <div                                                                                                                                                                      
                className="font-display text-8xl font-medium tnum tracking-tighter leading-none"
                style={{ color: scoreColor }}
              >                                                                                                                                                                         
                {Math.round(snapshot.healthScore)}
              </div>                                                                                                                                                                    
              <div className="font-tech text-[11px] text-[var(--ink-muted)] mt-2">
                / 100 — {scoreLabel}                                                                                                                                                    
              </div>
            </div>                                                                                                                                                                      
            <div className="flex-1 min-w-[160px]">          
              <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${snapshot.healthScore}%`,
                    background: 'linear-gradient(90deg, var(--brand), var(--brand-2))',
                  }}                                                                                                                                                                    
                />
              </div>                                                                                                                                                                    
              <div className="flex justify-between font-tech text-[10px] text-[var(--ink-subtle)] mt-1.5">
                <span>0</span><span>100</span>                                                                                                                                          
              </div>
            </div>                                                                                                                                                                      
          </div>                                            
        ) : (
          <div className="card p-8 mb-4 text-center text-sm text-[var(--ink-muted)]">
            No analysis data yet.                                                                                                                                                       
          </div>
        )}                                                                                                                                                                              
                                                            
        {/* Metrics */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">                                                                                                  
            {metrics.map(m => {
              const Icon = m.icon                                                                                                                                                       
              return (                                      
                <div key={m.label} className="card p-4">                                                                                                                                
                  <span
                    className="inline-flex w-8 h-8 rounded-lg items-center justify-center mb-3"                                                                                         
                    style={{ background: m.bg, color: m.color }}
                  >                                                                                                                                                                     
                    <Icon className="w-4 h-4" />
                  </span>                                                                                                                                                               
                  <div className="font-display text-2xl text-[var(--ink)] tnum tracking-tight">
                    {m.value}
                  </div>                                                                                                                                                                
                  <div className="font-tech text-[10px] uppercase tracking-[0.15em] text-[var(--ink-muted)] mt-0.5">
                    {m.label}                                                                                                                                                           
                  </div>                                    
                  <div className="font-tech text-[10px] text-[var(--ink-subtle)] mt-0.5">
                    {m.hint}                                                                                                                                                            
                  </div>
                </div>                                                                                                                                                                  
              )                                             
            })}
          </div>
        )}

        {/* CTA */}                                                                                                                                                                     
        <div className="card p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>                                                                                                                                                                         
            <h2 className="font-display text-xl text-[var(--ink)] tracking-tight mb-1">
              Want the full picture?                                                                                                                                                    
            </h2>
            <p className="text-[13px] text-[var(--ink-muted)] max-w-sm">                                                                                                                
              Sign in for AI agents, findings triage, drift history, and PR comments on every push.                                                                                     
            </p>
          </div>                                                                                                                                                                        
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white rounded-full px-5 py-2.5 hover:brightness-110 transition-all whitespace-nowrap"            
              style={{
                background: 'linear-gradient(135deg, var(--brand), var(--brand-2))',                                                                                                    
                boxShadow: '0 1px 3px rgba(5,150,105,0.3)', 
              }}                                                                                                                                                                        
            >                                               
              Open dashboard <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>                                                                                                                                                                     
            <Link
              href="/pricing"                                                                                                                                                           
              className="text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors whitespace-nowrap"
            >                                                                                                                                                                           
              View pricing
            </Link>                                                                                                                                                                     
          </div>                                            
        </div>

      </div>
    )
  }
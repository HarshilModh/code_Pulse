'use client'                                                                                                                                                                          

  import { useState, useEffect, useCallback } from 'react'                                                                                                                              
  import { useRouter } from 'next/navigation'               
  import { useAuth } from '@clerk/nextjs'                                                                                                                                               
  import { useQuery } from '@tanstack/react-query'
  // @ts-ignore: module without types
  import { Command } from 'cmdk'                                                                                                                                                        
  import {                                                  
    Search, ArrowUpRight, GitBranch, AlertTriangle,                                                                                                                                     
    FileCode, Settings, LayoutDashboard, DollarSign,                                                                                                                                    
  } from 'lucide-react'
  import { searchAll } from '@/lib/api'                                                                                                                                                 
                                                            
  const ACTIONS = [                                                                                                                                                                     
    { id: 'dashboard', label: 'Open dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { id: 'settings',  label: 'Open settings',  icon: Settings,        href: '/settings/api-keys' },                                                                                    
    { id: 'pricing',   label: 'View pricing',   icon: DollarSign,      href: '/pricing' },                                                                                              
  ]                                                                                                                                                                                     
                                                                                                                                                                                        
  export function CommandPalette() {                                                                                                                                                    
    const [open, setOpen] = useState(false)                 
    const [search, setSearch] = useState('')
    const router = useRouter()
    const { getToken, isSignedIn } = useAuth()                                                                                                                                          
   
    // ⌘K / Ctrl+K                                                                                                                                                                      
    useEffect(() => {                                       
      const handler = (e: KeyboardEvent) => {                                                                                                                                           
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {    
          e.preventDefault()                                                                                                                                                            
          setOpen(o => !o)
        }                                                                                                                                                                               
      }                                                     
      document.addEventListener('keydown', handler)
      return () => document.removeEventListener('keydown', handler)
    }, [])

    // Nav pill fires this custom event to open the palette                                                                                                                             
    useEffect(() => {
      const handler = () => setOpen(true)                                                                                                                                               
      window.addEventListener('open-palette', handler)                                                                                                                                  
      return () => window.removeEventListener('open-palette', handler)
    }, [])                                                                                                                                                                              
                                                            
    const { data, isLoading } = useQuery({                                                                                                                                              
      queryKey: ['palette-search', search],
      queryFn: async () => {                                                                                                                                                            
        const token = await getToken()                      
        return searchAll(search, token!)
      },                                                                                                                                                                                
      enabled: !!search.trim() && !!isSignedIn,
      staleTime: 30_000,                                                                                                                                                                
    })                                                                                                                                                                                  
   
    const navigate = useCallback((href: string) => {                                                                                                                                    
      router.push(href)                                     
      setOpen(false)
      setSearch('')
    }, [router])                                                                                                                                                                        
   
    return (                                                                                                                                                                            
      <Command.Dialog open={open} onOpenChange={setOpen} label="Command palette" className="fixed inset-0 z-[100]">
                                                                                                                                                                                        
        {/* Backdrop */}                                                                                                                                                                
        <div                                                                                                                                                                            
          className="absolute inset-0 bg-black/25 backdrop-blur-sm"                                                                                                                     
          onClick={() => setOpen(false)}                    
        />

        {/* Panel */}                                                                                                                                                                   
        <div
          className="relative max-w-xl w-full mx-auto mt-[14vh] rounded-2xl overflow-hidden"                                                                                            
          style={{                                                                                                                                                                      
            background: 'var(--surface)',
            border: '1px solid var(--rule-strong)',                                                                                                                                     
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.18), 0 8px 16px -8px rgba(0,0,0,0.08)',
          }}                                                                                                                                                                            
        >                                                   
          {/* Search input */}                                                                                                                                                          
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--rule)]">
            <Search className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />                                                                                                             
            <Command.Input                                                                                                                                                              
              value={search}
              onValueChange={setSearch}                                                                                                                                                 
              placeholder="Search repos, findings, files…"  
              className="flex-1 bg-transparent text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] outline-none"                                                         
            />
            {search && (                                                                                                                                                                
              <button                                                                                                                                                                   
                onClick={() => setSearch('')}
                className="font-tech text-[10px] text-[var(--ink-subtle)] hover:text-[var(--ink)] transition-colors"                                                                    
              >                                                                                                                                                                         
                clear
              </button>                                                                                                                                                                 
            )}                                              
            <kbd className="font-tech text-[10px] border border-[var(--rule)] rounded px-1.5 py-0.5 bg-[var(--canvas)] text-[var(--ink-subtle)]">
              esc                                                                                                                                                                       
            </kbd>
          </div>                                                                                                                                                                        
                                                            
          {/* Results */}                                                                                                                                                               
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-[13px] text-[var(--ink-muted)]">                                                                                           
              {isLoading ? 'Searching…' : 'No results.'}                                                                                                                                
            </Command.Empty>
                                                                                                                                                                                        
            {/* Actions — always shown */}                                                                                                                                              
            <Command.Group>
              <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] px-2 py-1.5">                                                                    
                Actions                                                                                                                                                                 
              </div>
              {ACTIONS.map(a => {                                                                                                                                                       
                const Icon = a.icon                         
                return (
                  <Command.Item
                    key={a.id}
                    value={a.label}
                    onSelect={() => navigate(a.href)}                                                                                                                                   
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[13px] text-[var(--ink)] data-[selected=true]:bg-[var(--surface-2)] transition-colors"
                  >                                                                                                                                                                     
                    <span className="inline-flex w-7 h-7 rounded-lg items-center justify-center bg-[var(--brand-light)] text-[var(--brand)]">
                      <Icon className="w-3.5 h-3.5" />                                                                                                                                  
                    </span>                                 
                    {a.label}                                                                                                                                                           
                    <ArrowUpRight className="w-3 h-3 ml-auto text-[var(--ink-subtle)]" />
                  </Command.Item>                                                                                                                                                       
                )
              })}                                                                                                                                                                       
            </Command.Group>                                
                                                                                                                                                                                        
            {/* Repos */}
            {(data?.repos?.length ?? 0) > 0 && (                                                                                                                                        
              <Command.Group>                               
                <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] px-2 py-1.5 mt-1">
                  Repositories                                                                                                                                                          
                </div>
                {data!.repos.map(r => (                                                                                                                                                 
                  <Command.Item                                                                                                                                                         
                    key={r.id}
                    value={`${r.owner}/${r.name}`}                                                                                                                                      
                    onSelect={() => navigate(`/repos/${r.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[13px] text-[var(--ink)] data-[selected=true]:bg-[var(--surface-2)] transition-colors"
                  >                                                                                                                                                                     
                    <span className="inline-flex w-7 h-7 rounded-lg items-center justify-center bg-[var(--surface-2)]">                                                                 
                      <GitBranch className="w-3.5 h-3.5 text-[var(--ink-muted)]" />                                                                                                     
                    </span>                                                                                                                                                             
                    <span className="text-[var(--ink-muted)]">{r.owner}/</span>{r.name}
                  </Command.Item>                                                                                                                                                       
                ))}                                         
              </Command.Group>                                                                                                                                                          
            )}                                                                                                                                                                          
   
            {/* Findings */}                                                                                                                                                            
            {(data?.findings?.length ?? 0) > 0 && (         
              <Command.Group>
                <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] px-2 py-1.5 mt-1">
                  Findings                                                                                                                                                              
                </div>
                {data!.findings.map(f => (                                                                                                                                              
                  <Command.Item                             
                    key={f.id}
                    value={f.title}
                    onSelect={() => navigate(`/repos/${f.repoId}/findings`)}                                                                                                            
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[13px] text-[var(--ink)] data-[selected=true]:bg-[var(--surface-2)] transition-colors"
                  >                                                                                                                                                                     
                    <span className="inline-flex w-7 h-7 rounded-lg items-center justify-center bg-[var(--signal-vuln-bg)]">
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--signal-vuln)]" />                                                                                               
                    </span>                                                                                                                                                             
                    <span className="flex-1 truncate">{f.title}</span>                                                                                                                  
                    <span className="font-tech text-[10px] text-[var(--ink-subtle)] shrink-0">{f.severity}</span>                                                                       
                  </Command.Item>                                                                                                                                                       
                ))}
              </Command.Group>                                                                                                                                                          
            )}                                              

            {/* Files */}
            {(data?.files?.length ?? 0) > 0 && (
              <Command.Group>                                                                                                                                                           
                <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] px-2 py-1.5 mt-1">
                  Files                                                                                                                                                                 
                </div>                                      
                {data!.files.map((f, i) => (                                                                                                                                            
                  <Command.Item                             
                    key={i}
                    value={f.filePath}
                    onSelect={() => navigate(`/repos/${f.repoId}/files/${f.filePath}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[13px] text-[var(--ink)] data-[selected=true]:bg-[var(--surface-2)] transition-colors"
                  >                                                                                                                                                                     
                    <span className="inline-flex w-7 h-7 rounded-lg items-center justify-center bg-[var(--brand-light)]">                                                               
                      <FileCode className="w-3.5 h-3.5 text-[var(--brand)]" />                                                                                                          
                    </span>                                 
                    <span className="font-tech text-[12px] truncate">{f.filePath}</span>                                                                                                
                  </Command.Item>                                                                                                                                                       
                ))}
              </Command.Group>                                                                                                                                                          
            )}                                              
          </Command.List>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--rule)] flex items-center gap-4 font-tech text-[10px] text-[var(--ink-subtle)]">
            <span><kbd className="border border-[var(--rule)] rounded px-1 py-0.5 bg-[var(--canvas)]">↑↓</kbd> navigate</span>                                                          
            <span><kbd className="border border-[var(--rule)] rounded px-1 py-0.5 bg-[var(--canvas)]">↵</kbd> open</span>                                                               
            <span><kbd className="border border-[var(--rule)] rounded px-1 py-0.5 bg-[var(--canvas)]">esc</kbd> close</span>                                                            
          </div>                                                                                                                                                                        
        </div>                                                                                                                                                                          
                                                                                                                                                                                        
      </Command.Dialog>                                     
    )
  }
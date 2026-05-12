'use client'                                                                                                                                                                          
   
  import { useState, useRef, useEffect, useCallback } from 'react'                                                                                                                      
  import { useRouter } from 'next/navigation'               
  import { useAuth } from '@clerk/nextjs'
  import { useQuery } from '@tanstack/react-query'                                                                                                                                      
  import { Search, GitBranch, AlertTriangle, FileCode } from 'lucide-react'
  import { searchAll } from '@/lib/api'                                                                                                                                                 
                                                            
  export function GlobalSearchBar() {                                                                                                                                                   
    const [focused, setFocused] = useState(false)           
    const [query, setQuery]     = useState('')                                                                                                                                          
    const inputRef  = useRef<HTMLInputElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)                                                                                                                                     
    const router    = useRouter()                           
    const { getToken, isSignedIn } = useAuth()                                                                                                                                          
                                                                                                                                                                                        
    const { data, isLoading } = useQuery({
      queryKey: ['global-search', query],                                                                                                                                               
      queryFn: async () => {                                
        const token = await getToken()
        return searchAll(query, token!)
      },                                                                                                                                                                                
      enabled: !!query.trim() && !!isSignedIn && focused,
      staleTime: 30_000,                                                                                                                                                                
    })                                                      
                                                                                                                                                                                        
    const hasResults =                                                                                                                                                                  
      (data?.repos?.length ?? 0) > 0 ||
      (data?.findings?.length ?? 0) > 0 ||                                                                                                                                              
      (data?.files?.length ?? 0) > 0                        

    const showDropdown = focused && !!query.trim()                                                                                                                                      
   
    // Close on click outside                                                                                                                                                           
    useEffect(() => {                                       
      const handler = (e: MouseEvent) => {                                                                                                                                              
        if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
          setFocused(false)                                                                                                                                                             
          setQuery('')                                      
        }
      }
      document.addEventListener('mousedown', handler)                                                                                                                                   
      return () => document.removeEventListener('mousedown', handler)
    }, [])                                                                                                                                                                              
                                                            
    // Close on Escape
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') { setFocused(false); setQuery('') }                                                                                                                     
      }
      document.addEventListener('keydown', handler)                                                                                                                                     
      return () => document.removeEventListener('keydown', handler)
    }, [])                                                                                                                                                                              
   
    const navigate = useCallback((href: string) => {                                                                                                                                    
      router.push(href)                                     
      setFocused(false)
      setQuery('')
    }, [router])

    return (                                                                                                                                                                            
      <div ref={wrapperRef} className="relative hidden md:flex items-center mr-3">
                                                                                                                                                                                        
        {/* Input pill */}                                                                                                                                                              
        <div
          className={`flex items-center gap-2.5 h-8 rounded-full px-3 transition-all border ${                                                                                          
            focused                                                                                                                                                                     
              ? 'w-56 bg-[var(--surface)] border-[var(--brand)]/40 ring-2 ring-[var(--brand)]/10'
              : 'w-36 bg-[var(--surface)] border-[var(--rule)] hover:border-[var(--rule-strong)] cursor-pointer'                                                                        
          }`}                                                                                                                                                                           
          onClick={() => { setFocused(true); inputRef.current?.focus() }}                                                                                                               
        >                                                                                                                                                                               
          <Search className="w-3 h-3 text-[var(--ink-muted)] shrink-0" />
          <input                                                                                                                                                                        
            ref={inputRef}
            value={query}                                                                                                                                                               
            onChange={e => setQuery(e.target.value)}        
            onFocus={() => setFocused(true)}
            placeholder={focused ? 'Search…' : 'Search'}
            className="flex-1 bg-transparent text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] outline-none min-w-0"                                                   
          />                                                                                                                                                                            
          {!focused && (                                                                                                                                                                
            <kbd className="font-tech text-[10px] border border-[var(--rule)] rounded px-1.5 py-0.5 bg-[var(--canvas)] text-[var(--ink-subtle)] leading-none shrink-0">                 
              ⌘K                                                                                                                                                                        
            </kbd>                                                                                                                                                                      
          )}                                                                                                                                                                            
        </div>                                                                                                                                                                          
                                                            
        {/* Dropdown */}
        {showDropdown && (
          <div
            className="absolute top-full right-0 mt-2 w-80 rounded-2xl overflow-hidden z-50"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--rule-strong)',                                                                                                                                   
              boxShadow: '0 16px 40px -8px rgba(0,0,0,0.14), 0 4px 8px -4px rgba(0,0,0,0.06)',
            }}                                                                                                                                                                          
          >                                                 
            {isLoading && (                                                                                                                                                             
              <div className="px-4 py-6 text-center font-tech text-[12px] text-[var(--ink-muted)]">                                                                                     
                Searching…
              </div>                                                                                                                                                                    
            )}                                              

            {!isLoading && !hasResults && (                                                                                                                                             
              <div className="px-4 py-6 text-center text-[13px] text-[var(--ink-muted)]">
                No results for <span className="font-tech text-[var(--ink)]">{query}</span>                                                                                             
              </div>                                                                                                                                                                    
            )}
                                                                                                                                                                                        
            {/* Repos */}                                   
            {(data?.repos?.length ?? 0) > 0 && (
              <div className="p-2">                                                                                                                                                     
                <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] px-2 py-1.5">
                  Repositories                                                                                                                                                          
                </div>                                      
                {data!.repos.map(r => (                                                                                                                                                 
                  <button                                   
                    key={r.id}
                    onClick={() => navigate(`/repos/${r.id}`)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors text-left"
                  >                                                                                                                                                                     
                    <span className="inline-flex w-6 h-6 rounded-md items-center justify-center bg-[var(--surface-2)] shrink-0">
                      <GitBranch className="w-3 h-3 text-[var(--ink-muted)]" />                                                                                                         
                    </span>                                 
                    <span className="text-[13px] text-[var(--ink)] truncate">                                                                                                           
                      <span className="text-[var(--ink-muted)]">{r.owner}/</span>{r.name}                                                                                               
                    </span>                                                                                                                                                             
                  </button>                                                                                                                                                             
                ))}                                                                                                                                                                     
              </div>                                        
            )}

            {/* Findings */}
            {(data?.findings?.length ?? 0) > 0 && (
              <div className="p-2 border-t border-[var(--rule)]">                                                                                                                       
                <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] px-2 py-1.5">
                  Findings                                                                                                                                                              
                </div>                                      
                {data!.findings.map(f => (                                                                                                                                              
                  <button                                   
                    key={f.id}
                    onClick={() => navigate(`/repos/${f.repoId}/findings`)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors text-left"                                           
                  >
                    <span className="inline-flex w-6 h-6 rounded-md items-center justify-center bg-[var(--signal-vuln-bg)] shrink-0">                                                   
                      <AlertTriangle className="w-3 h-3 text-[var(--signal-vuln)]" />                                                                                                   
                    </span>                                                                                                                                                             
                    <span className="text-[13px] text-[var(--ink)] truncate flex-1">{f.title}</span>                                                                                    
                    <span className="font-tech text-[10px] text-[var(--ink-subtle)] shrink-0">{f.severity}</span>                                                                       
                  </button>                                                                                                                                                             
                ))}
              </div>                                                                                                                                                                    
            )}                                              

            {/* Files */}
            {(data?.files?.length ?? 0) > 0 && (
              <div className="p-2 border-t border-[var(--rule)]">                                                                                                                       
                <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] px-2 py-1.5">
                  Files                                                                                                                                                                 
                </div>                                      
                {data!.files.map((f, i) => (                                                                                                                                            
                  <button                                   
                    key={i}
                    onClick={() => navigate(`/repos/${f.repoId}/files/${f.filePath}`)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors text-left"                                           
                  >
                    <span className="inline-flex w-6 h-6 rounded-md items-center justify-center bg-[var(--brand-light)] shrink-0">                                                      
                      <FileCode className="w-3 h-3 text-[var(--brand)]" />
                    </span>                                                                                                                                                             
                    <span className="font-tech text-[12px] text-[var(--ink)] truncate">{f.filePath}</span>
                  </button>                                                                                                                                                             
                ))}                                                                                                                                                                     
              </div>
            )}                                                                                                                                                                          
                                                            
            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-[var(--rule)] font-tech text-[10px] text-[var(--ink-subtle)]">
              Press <kbd className="border border-[var(--rule)] rounded px-1 bg-[var(--canvas)]">⌘K</kbd> for full search                                                               
            </div>                                                                                                                                                                      
          </div>                                                                                                                                                                        
        )}                                                                                                                                                                              
      </div>                                                
    )
  }
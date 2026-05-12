"use client";

import Link from 'next/link';
import { useState } from 'react';
import { Check } from 'lucide-react';
                                                                                                  
const PricingPage = () => {
    const [annual, setAnnual] = useState(false);
    return (                                                                                                                                   
      <div className="w-full bg-[var(--canvas)]">                                                     
        
  {/* ── Hero ── */}                                                                                                                           
  <section className="relative px-6 sm:px-10 pt-20 pb-16 overflow-hidden text-center">
    <div className="hero-blobs">                                                                                                               
      <div className="blob indigo" />                                                                                                          
      <div className="blob violet" />                                                                                                          
      <div className="blob cyan" />                                                                                                            
    </div>                                                                                                                                     
   
    <div className="relative max-w-3xl mx-auto">                                                                                               
      <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-6">
        — Pricing                                                                                                                              
      </div>                                                                                                                                   
      <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-[var(--ink)] tracking-tighter font-medium leading-[0.95] mb-6">        
        Simple, transparent <span className="italic tri-gradient brand-gradient-animated">pricing</span>.                                      
      </h1>                                                                                                                                    
      <p className="text-lg text-[var(--ink-soft)] max-w-xl mx-auto mb-10">                                                                    
        Free for public repos. Upgrade when you need AI agents, private repos, or your whole team.                                             
      </p>                                                                                                                                     
                                                                                                                                               
      {/* Monthly / Annual toggle */}                                                                                                          
      <div className="inline-flex items-center gap-3 bg-[var(--surface)] border border-[var(--rule)] rounded-full px-2 py-1.5">
        <button                                                                                                                                
          onClick={() => setAnnual(false)}                  
          className={`text-[13px] font-medium rounded-full px-4 py-1.5 transition-all ${                                                       
            !annual ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'                             
          }`}                                                                                                                                  
        >                                                                                                                                      
          Monthly                                                                                                                              
        </button>                                           
        <button
          onClick={() => setAnnual(true)}                                                                                                      
          className={`inline-flex items-center gap-2 text-[13px] font-medium rounded-full px-4 py-1.5 transition-all ${
            annual ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'                              
          }`}                                               
        >                                                                                                                                      
          Annual                                            
          <span className="font-tech text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--brand-light)] text-[var(--brand)]">
            –20%                                                                                                                               
          </span>
        </button>                                                                                                                              
      </div>                                                
    </div>
  </section>    
     <section className="px-6 sm:px-10 pb-24">                 
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-start">                                                      
                                                                                                                                               
      {/* Free */}                                                                                                                             
      <div className="card p-8 flex flex-col">                                                                                                 
        <div className="mb-6">                                                                                                                 
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">Free</div>
          <div className="flex items-baseline gap-1 mb-2">                                                                                     
            <span className="font-display text-5xl font-medium text-[var(--ink)] tracking-tight">$0</span>
            <span className="text-[13px] text-[var(--ink-muted)]">/ month</span>                                                               
          </div>                                                                                                                               
          <p className="text-[13px] text-[var(--ink-soft)]">For individuals exploring public repos.</p>                                        
        </div>                                                                                                                                 
                                                            
        <ul className="space-y-3 mb-8 flex-1">                                                                                                 
          {[                                                
            '3 repositories',                                                                                                                  
            'Public repos only',                            
            '7 days of history',
            'All 5 analysis signals',
            'README badges',                                                                                                                   
            'Dashboard access',
          ].map(f => (                                                                                                                         
            <li key={f} className="flex items-center gap-2.5 text-[13px] text-[var(--ink-soft)]">
              <Check className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />                                                                   
              {f}                                                                                                                              
            </li>                                                                                                                              
          ))}                                                                                                                                  
        </ul>                                               

        <Link
          href="/dashboard"
          className="w-full text-center text-[13px] font-medium text-[var(--ink)] border border-[var(--rule)] rounded-full px-4 py-2.5 
  hover:border-[var(--rule-strong)] hover:bg-[var(--surface-2)] transition-all"                                                                
        >
          Get started free                                                                                                                     
        </Link>                                             
      </div>

      {/* Pro — highlighted */}
        <div className="card p-8 flex flex-col relative ring-2 ring-[var(--brand)] shadow-lg" style={{ boxShadow: '0 0 0 2px var(--brand), 0 8px 32px rgba(5,150,105,0.12)' }}>                                                                                                               
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="font-tech text-[10px] uppercase tracking-[0.2em] text-white bg-[var(--brand)] rounded-full px-3 py-1">              
            Most popular                                                                                                                       
          </span>                                                                                                                              
        </div>                                                                                                                                 
                                                            
        <div className="mb-6">                                                                                                                 
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--brand)] mb-3">Pro</div>
          <div className="flex items-baseline gap-1 mb-2">                                                                                     
            <span className="font-display text-5xl font-medium text-[var(--ink)] tracking-tight">
              ${annual ? '15' : '19'}                                                                                                          
            </span>
            <span className="text-[13px] text-[var(--ink-muted)]">/ month</span>                                                               
          </div>                                            
          <p className="text-[13px] text-[var(--ink-soft)]">For engineers who ship continuously.</p>                                           
        </div>                                                                                                                                 
   
        <ul className="space-y-3 mb-8 flex-1">                                                                                                 
          {[                                                
            'Unlimited repositories',
            'Public + private repos',                                                                                                          
            '30 days of history',
            'Everything in Free',                                                                                                              
            'AI agents (chat, root-cause, debate)',         
            'Codebase tour',                                                                                                                   
            'PR comments on push',
            'API keys + MCP server',                                                                                                           
          ].map(f => (                                                                                                                         
            <li key={f} className="flex items-center gap-2.5 text-[13px] text-[var(--ink-soft)]">
              <Check className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />                                                                   
              {f}                                                                                                                              
            </li>
          ))}                                                                                                                                  
        </ul>                                               

        <Link
          href="#"
          className="w-full text-center text-[13px] font-medium text-white rounded-full px-4 py-2.5 transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))', boxShadow: '0 1px 3px rgba(5,150,105,0.3), 0 4px 12px rgba(5,150,105,0.18)' }}                                                                                                                     
        >                                                                                                                                      
          Upgrade to Pro                                                                                                                       
        </Link>                                             
      </div>

      {/* Team */}
      <div className="card p-8 flex flex-col">
        <div className="mb-6">                                                                                                                 
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">Team</div>
          <div className="flex items-baseline gap-1 mb-2">                                                                                     
            <span className="font-display text-5xl font-medium text-[var(--ink)] tracking-tight">
              ${annual ? '39' : '49'}                                                                                                          
            </span>                                                                                                                            
            <span className="text-[13px] text-[var(--ink-muted)]">/ month</span>
          </div>                                                                                                                               
          <p className="text-[13px] text-[var(--ink-soft)]">For teams that need shared visibility.</p>
        </div>                                                                                                                                 
   
        <ul className="space-y-3 mb-8 flex-1">                                                                                                 
          {[                                                
            'Everything in Pro',                                                                                                               
            'Unlimited seats',
            '90 days of history',                                                                                                              
            'Shared findings triage',                       
            'Custom drift thresholds',                                                                                                         
            'Priority support',
            'SSO (coming soon)',                                                                                                               
          ].map(f => (                                      
            <li key={f} className="flex items-center gap-2.5 text-[13px] text-[var(--ink-soft)]">
              <Check className="w-3.5 h-3.5 text-[var(--brand-2)] shrink-0" />                                                                 
              {f}                                                                                                                              
            </li>                                                                                                                              
          ))}                                                                                                                                  
        </ul>                                               

        <Link
          href="#"
          className="w-full text-center text-[13px] font-medium text-[var(--ink)] border border-[var(--rule)] rounded-full px-4 py-2.5 
  hover:border-[var(--rule-strong)] hover:bg-[var(--surface-2)] transition-all"                                                                
        >
          Upgrade to Team                                                                                                                      
        </Link>                                             
      </div>                                                                                                                                   
   
    </div>                                                                                                                                     
  </section>                     
  <section className="relative px-6 sm:px-10 py-32 overflow-hidden text-center">
    <div className="hero-blobs">                                                                                                               
      <div className="blob indigo" />                                                                                                          
      <div className="blob cyan" />                                                                                                            
    </div>                                                                                                                                     
                                                            
    <div className="relative max-w-2xl mx-auto">                                                                                               
      <h2 className="font-display text-4xl sm:text-5xl text-[var(--ink)] tracking-tighter font-medium leading-[0.95] mb-6">
        Start free.<br />                                                                                                                      
        <span className="italic tri-gradient">Upgrade when it clicks.</span>                                                                   
      </h2>                                                                                                                                    
      <p className="text-[15px] text-[var(--ink-soft)] mb-10 max-w-md mx-auto">                                                                
        No credit card required. Public repos are free forever. Upgrade only when you need agents, private access, or your whole team.         
      </p>                                                                                                                                     
      <div className="flex items-center justify-center gap-3 flex-wrap">                                                                       
        <Link                                                                                                                                  
          href="/dashboard"                                 
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white rounded-full px-6 py-3 transition-all                 
  hover:brightness-110 cta-glow"                                                                                                               
          style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
        >                                                                                                                                      
          Open dashboard                                    
        </Link>                                                                                                                                
        <Link                                               
          href="/"
          className="text-[14px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors px-3 py-3"                                  
        >                                                                                                                                      
          Back to home                                                                                                                         
        </Link>                                                                                                                                
      </div>                                                
    </div>
  </section>                                                                                               
      </div>                                                                                                                                   
    )
  }                                                                                                                                            
              

export default PricingPage
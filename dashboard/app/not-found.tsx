import Link from 'next/link'
import { ArrowLeft, SearchX } from 'lucide-react'
import { Logo } from '../components/logo'

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-[var(--canvas)] flex flex-col items-center justify-center relative overflow-hidden px-6">
      
      {/* Background textures */}
      <div className="absolute inset-0 dot-grid pointer-events-none opacity-60" />
      <div className="scan-beam" />
      
      {/* Faint brand glow behind the 404 */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl pointer-events-none" 
        style={{ background: 'var(--brand)' }} 
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
        
        {/* Floating Logo */}
        <div className="mb-10 rise-in relative">
          <div className="absolute -inset-4 bg-[var(--brand-light)] rounded-full blur-xl opacity-50 pulse" />
          <Logo className="w-16 h-16 relative z-10 opacity-80" />
        </div>

        {/* Technical eyebrow */}
        <div className="rise-in rise-in-1 inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[var(--signal-vuln-bg)] border border-[var(--signal-vuln)]/20">
          <SearchX className="w-3.5 h-3.5" style={{ color: 'var(--signal-vuln)' }} />
          <span className="font-tech text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--signal-vuln)' }}>
            Error 404 · Dead Link
          </span>
        </div>

        {/* Headline */}
        <h1 className="rise-in rise-in-2 font-display text-[var(--ink)] text-6xl sm:text-7xl leading-none tracking-tighter font-medium mb-6">
          Pulse <span className="italic tri-gradient brand-gradient-animated">lost</span>.
        </h1>

        {/* Body */}
        <p className="rise-in rise-in-3 text-[15px] sm:text-[17px] text-[var(--ink-soft)] leading-relaxed mb-10">
          We scanned the repository but couldn't find the page you're looking for. It might have been moved, deleted, or never existed in the first place.
        </p>

        {/* CTAs */}
        <div className="rise-in rise-in-4 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 text-[14px] font-medium text-white rounded-full px-6 py-2.5 transition-all hover:brightness-110 active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
              boxShadow: '0 1px 3px rgba(5,150,105,0.3), 0 4px 12px rgba(5,150,105,0.18)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center text-[14px] font-medium text-[var(--ink)] hover:text-[var(--brand)] transition-colors px-6 py-2.5"
          >
            Go to Homepage
          </Link>
        </div>

        {/* Tech footer */}
        <div className="mt-16 font-tech text-[10px] text-[var(--ink-subtle)] uppercase tracking-[0.2em] rise-in rise-in-4">
          Session {Math.random().toString(36).substring(2, 10)}
        </div>
      </div>
    </div>
  )
}

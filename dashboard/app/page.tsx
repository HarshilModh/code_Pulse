'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth, SignInButton, UserButton, Show } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { analyzeRepo } from '@/lib/api'
import {
  ArrowRight, ArrowUpRight, ArrowDownRight,
  Zap, ShieldAlert, TestTube2, Ghost, Radar, Activity,
  Bot, Workflow, GitPullRequest, MessageSquare, Sparkles, AlertTriangle,
  Check, Cpu,
} from 'lucide-react'

/* ============================================================================
   CodePulse — modern, lively, light. Personality-forward without AI slop.
   ----------------------------------------------------------------------------
   Visual building blocks:
     · three soft glowing blobs (indigo/violet/cyan) drifting in the hero
     · animated tri-gradient on the headline emphasis word
     · ECG signature line drawn under the headline
     · glass dashboard preview with a custom donut score gauge
     · two floating insight cards overlapping the preview (tilted, glassy)
     · orbital diagram for the AI agents — five workers on rings around a core
     · live ticker of recent analyses, with heartbeat dot
     · color-coded signal cards with always-on tinted backgrounds
   ============================================================================ */

// ─── GitHub icon (Octicons path — lucide dropped this) ──────────────────────
function GithubIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

// ─── X / Twitter icon ──────────────────────────────────────────────────────
function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

// ─── Marketing nav ─────────────────────────────────────────────────────────
function MarketingNav() {
  return (
    <header className="marketing-nav">
      {/* 1.5px brand gradient top strip */}
      <div
        className="h-[1.5px] w-full"
        style={{ background: 'linear-gradient(90deg, var(--brand-3), var(--brand) 40%, var(--brand-2))' }}
      />

      {/* items-stretch so nav links can pin a 2px bar to the nav bottom */}
      <div className="max-w-[76rem] mx-auto px-6 sm:px-10 h-[52px] flex items-stretch justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mr-8 shrink-0 hover:opacity-75 transition-opacity outline-none">
          <BrandMark className="w-5 h-5" />
          <span className="font-display text-[16px] font-semibold text-[var(--ink)] tracking-tight leading-none">
            codepulse
          </span>
          <span className="relative flex w-1.5 h-1.5 self-center">
            <span className="absolute inset-0 rounded-full bg-[var(--positive)] opacity-50 heartbeat" />
            <span className="absolute inset-0 rounded-full bg-[var(--positive)]" />
          </span>
        </Link>

        {/* Center nav — full-height links, hover underline bar, no pill backgrounds */}
        <nav className="hidden md:flex items-stretch">
          {([
            { href: '#signals', label: 'Signals' },
            { href: '#method',  label: 'Method'  },
            { href: '#agents',  label: 'Agents', badge: 'AI' },
            { href: '/pricing', label: 'Pricing' },
          ] as { href: string; label: string; badge?: string }[]).map(({ href, label, badge }) => (
            <Link
              key={label}
              href={href}
              className="relative inline-flex items-center gap-1.5 px-3.5 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors outline-none group"
            >
              {label}
              {badge && (
                <span className="font-tech text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--brand-light)] text-[var(--brand)] leading-none">
                  {badge}
                </span>
              )}
              {/* Slide-in underline on hover — same 2px gradient bar as app nav */}
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
                style={{ background: 'linear-gradient(90deg, var(--brand), var(--brand-2))' }}
              />
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="hidden sm:inline-flex w-8 h-8 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
          >
            <GithubIcon className="w-4 h-4" />
          </a>

          <div className="hidden sm:block w-px h-4 bg-[var(--rule)] mx-2" />

          <Show when="signed-out">
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] px-3.5 transition-colors">
                Sign in
              </button>
            </SignInButton>
          </Show>

          <Show when="signed-in">
            <UserButton appearance={{ elements: { avatarBox: 'w-7 h-7 ring-1 ring-[var(--rule)]' } }} />
          </Show>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white rounded-full px-4 py-1.5 transition-all hover:brightness-110 active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
              boxShadow: '0 1px 3px rgba(5,150,105,0.3), 0 4px 12px rgba(5,150,105,0.18)',
            }}
          >
            Dashboard
          </Link>
        </div>

      </div>
    </header>
  )
}

// ─── Brand mark — a custom ECG-stroke logo, gradient indigo→violet→cyan ────
function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%"  stopColor="var(--brand-3)" />
          <stop offset="55%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--brand-2)" />
        </linearGradient>
      </defs>
      <path
        d="M3 16 H8 L11 9 L15 23 L18 13 L21 18 H29"
        stroke="url(#bm)" strokeWidth={2.4}
        fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Animated counter ──────────────────────────────────────────────────────
function Counter({ to, suffix = '', durationMs = 1400 }: {
  to: number; suffix?: string; durationMs?: number
}) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setN(Math.round(to * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, durationMs])
  return <>{n.toLocaleString()}{suffix}</>
}

// ─── ECG signature line ────────────────────────────────────────────────────
function PulseLine({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id="pl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="var(--brand-3)" />
          <stop offset="50%"  stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--brand-2)" />
        </linearGradient>
      </defs>
      <path
        d="M0 30 L 320 30 L 340 30 L 360 12 L 380 48 L 400 22 L 440 30 L 740 30 L 760 8 L 780 52 L 800 30 L 1200 30"
        fill="none" stroke="url(#pl)" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round"
        className="draw-pulse"
      />
    </svg>
  )
}

// ─── Hero URL form (with terminal-style monospace input) ───────────────────
function HeroForm() {
  const { isSignedIn, getToken } = useAuth()
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true); setErr(null)
    try {
      const token = await getToken()
      const { repoId } = await analyzeRepo(url.trim(), token!)
      router.push(`/repos/${repoId}`)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Analysis failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="w-full max-w-xl">
      <form
        onSubmit={submit}
        className="glass-strong gradient-ring flex items-center gap-1.5 rounded-2xl p-1.5 transition-all"
      >
        <span className="pl-3 pr-1 font-tech text-[12px] text-[var(--ink-subtle)] hidden sm:inline">
          https://github.com/
        </span>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="vercel/swr"
          disabled={loading}
          className="flex-1 bg-transparent font-tech text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] outline-none px-2 py-2 min-w-0"
        />
        {!url && <span className="font-tech text-[14px] text-[var(--brand)] blink-cursor pr-1">▋</span>}
        {isSignedIn ? (
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-white rounded-xl px-4 py-2 transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
              boxShadow: 'var(--shadow-cta)',
            }}
          >
            {loading ? 'Examining' : 'Examine'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <SignInButton mode="modal" forceRedirectUrl="/dashboard">
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-white rounded-xl px-4 py-2 transition-all hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
                boxShadow: 'var(--shadow-cta)',
              }}
            >
              Sign in to examine <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </SignInButton>
        )}
      </form>
      {err && <p className="mt-3 text-[12px] text-[var(--negative)]">{err}</p>}
    </div>
  )
}

// ─── Donut score gauge — custom SVG, multi-color stroke arc ────────────────
function ScoreGauge({ score = 87 }: { score?: number }) {
  const r = 96
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg viewBox="0 0 240 240" className="w-full h-full">
      <defs>
        <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="var(--brand-3)" />
          <stop offset="50%"  stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--brand-2)" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle cx={120} cy={120} r={r} stroke="rgba(15,14,12,0.06)" strokeWidth={14} fill="none" />
      {/* Arc */}
      <circle
        cx={120} cy={120} r={r}
        stroke="url(#gg)" strokeWidth={14} fill="none" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 120 120)"
      />
      {/* Tick marks around the dial */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2
        // Round to 2 decimal places to prevent hydration mismatch
        const x1 = +(120 + Math.cos(a) * 116).toFixed(2)
        const y1 = +(120 + Math.sin(a) * 116).toFixed(2)
        const x2 = +(120 + Math.cos(a) * 122).toFixed(2)
        const y2 = +(120 + Math.sin(a) * 122).toFixed(2)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(15,14,12,0.12)" strokeWidth={1} />
      })}
    </svg>
  )
}

// ─── Live ticker ───────────────────────────────────────────────────────────
const TICKER = [
  { repo: 'vercel/swr',          delta: '+2.1' },
  { repo: 'facebook/react',      delta: '−0.4' },
  { repo: 'tailwindlabs/heroicons', delta: '+0.0' },
  { repo: 'expressjs/express',   delta: '+3.6' },
  { repo: 'denoland/deno',       delta: '+1.0' },
  { repo: 'prisma/prisma',       delta: '−1.2' },
  { repo: 'shadcn-ui/ui',        delta: '+0.3' },
  { repo: 'BurntSushi/ripgrep',  delta: '+0.0' },
  { repo: 'fastify/fastify',     delta: '+2.8' },
  { repo: 'sveltejs/svelte',     delta: '+0.7' },
  { repo: 'withastro/astro',     delta: '−0.2' },
  { repo: 'hashicorp/terraform', delta: '+1.5' },
]
function LiveTicker() {
  const items = [...TICKER, ...TICKER]
  return (
    <div className="marquee-pause overflow-hidden py-3 relative">
      <div className="flex items-center gap-3 mb-2 px-6 sm:px-10 max-w-6xl mx-auto">
        <span className="relative flex w-1.5 h-1.5">
          <span className="absolute inset-0 rounded-full bg-[var(--positive)] opacity-50 heartbeat" />
          <span className="absolute inset-0 rounded-full bg-[var(--positive)]" />
        </span>
        <span className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          Live · examined in the last hour
        </span>
        <span className="ml-auto font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-subtle)] hidden sm:inline">
          14.2s median
        </span>
      </div>
      <div className="marquee-slide flex gap-10 whitespace-nowrap font-tech text-[12px] text-[var(--ink-muted)]">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-2 shrink-0">
            <span className="text-[var(--ink)]">{it.repo}</span>
            <span className={
              it.delta.startsWith('+') ? 'text-[var(--positive)]' :
              it.delta.startsWith('−') ? 'text-[var(--negative)]' : 'text-[var(--ink-subtle)]'
            }>
              {it.delta}
            </span>
            <span className="text-[var(--ink-subtle)] ml-6">·</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard preview — glass card with donut + metrics, plus floating cards ─
function DashboardPreview() {
  return (
    <div className="relative max-w-5xl mx-auto">
      {/* Backing glow */}
      <div className="absolute -inset-x-12 -inset-y-8 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-40" style={{ background: 'var(--brand)' }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-30" style={{ background: 'var(--brand-2)' }} />
      </div>

      {/* Main glass card */}
      <div className="relative glass rounded-3xl overflow-hidden gradient-ring">
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/60">
          <div className="flex items-center gap-2.5">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-[var(--positive)] opacity-50 heartbeat" />
              <span className="absolute inset-0 rounded-full bg-[var(--positive)]" />
            </span>
            <span className="font-tech text-[12px] text-[var(--ink)]">vercel/swr</span>
            <span className="font-tech text-[11px] text-[var(--ink-subtle)]">main · a3f9c12</span>
          </div>
          <span className="inline-flex items-center gap-1.5 font-tech text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-full bg-emerald-50 text-[var(--positive)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)]" />
            Healthy
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Donut score */}
          <div className="lg:col-span-5 p-8 border-b lg:border-b-0 lg:border-r border-white/60 relative">
            <div className="flex items-start justify-between mb-2">
              <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Health Score
              </div>
              <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-subtle)]">
                ↑ +2.1 wk
              </div>
            </div>

            <div className="relative aspect-square max-w-[260px] mx-auto">
              <ScoreGauge score={87} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-[5.5rem] leading-none font-medium tnum tri-gradient">87</span>
                <span className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mt-1">/ 100</span>
              </div>
            </div>
          </div>

          {/* Metric grid */}
          <div className="lg:col-span-7 grid grid-cols-2">
            {[
              { label: 'Complexity',     value: '4.2',  hint: 'avg cyclomatic',     color: 'var(--signal-complexity)', bg: 'var(--signal-complexity-bg)', icon: Zap },
              { label: 'Vulnerabilities', value: '0',   hint: 'critical / high',    color: 'var(--signal-vuln)',       bg: 'var(--signal-vuln-bg)',       icon: ShieldAlert },
              { label: 'Coverage',        value: '92%', hint: 'lcov parsed',        color: 'var(--signal-coverage)',   bg: 'var(--signal-coverage-bg)',   icon: TestTube2 },
              { label: 'Drift',           value: '0.81', hint: 'cosine similarity', color: 'var(--signal-drift)',      bg: 'var(--signal-drift-bg)',      icon: Radar },
            ].map((m, i) => {
              const Icon = m.icon
              return (
                <div
                  key={m.label}
                  className={`p-6 ${i % 2 === 0 ? 'border-r border-white/60' : ''} ${i < 2 ? 'border-b border-white/60' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="inline-flex w-7 h-7 rounded-lg items-center justify-center"
                      style={{ background: m.bg, color: m.color }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-tech text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      {m.label}
                    </span>
                  </div>
                  <div className="font-display text-3xl text-[var(--ink)] tnum tracking-tight">{m.value}</div>
                  <div className="font-tech text-[10px] text-[var(--ink-subtle)] mt-1">{m.hint}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Floating "Top Risk" insight card — overlaps top-left */}
      <div className="absolute -top-6 -left-4 sm:-left-12 w-64 float-card tilt-l p-4 hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="inline-flex w-5 h-5 rounded items-center justify-center"
            style={{ background: 'var(--signal-vuln-bg)', color: 'var(--signal-vuln)' }}
          >
            <AlertTriangle className="w-3 h-3" />
          </span>
          <span className="font-tech text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--signal-vuln)' }}>
            Top risk
          </span>
        </div>
        <h4 className="text-sm font-medium text-[var(--ink)] mb-1">
          src/use-swr.ts is <span className="font-tech">23-cyclomatic</span>
        </h4>
        <p className="text-[12px] text-[var(--ink-muted)] leading-relaxed">
          Two callbacks past the project median. Refactor before it eats three hours of debugging.
        </p>
      </div>

      {/* Floating "Next Action" card — overlaps bottom-right */}
      <div className="absolute -bottom-6 -right-4 sm:-right-10 w-64 float-card tilt-r p-4 hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="inline-flex w-5 h-5 rounded items-center justify-center"
            style={{ background: 'var(--signal-coverage-bg)', color: 'var(--signal-coverage)' }}
          >
            <Check className="w-3 h-3" />
          </span>
          <span className="font-tech text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--signal-coverage)' }}>
            Next action
          </span>
        </div>
        <h4 className="text-sm font-medium text-[var(--ink)] mb-1">
          Extract the <span className="font-tech">cache</span> cluster
        </h4>
        <p className="text-[12px] text-[var(--ink-muted)] leading-relaxed">
          ssr-bridge files share 0.74 similarity with core-cache. Splitting them removes a circular import.
        </p>
      </div>
    </div>
  )
}

// ─── Orbital diagram for the agents section ────────────────────────────────
// A core (the codebase) with five workers on rings around it.
function OrbitalDiagram() {
  const workers = [
    { angle: -90,  label: 'complexity', color: 'var(--signal-complexity)' },
    { angle: -18,  label: 'vulns',      color: 'var(--signal-vuln)' },
    { angle: 54,   label: 'coverage',   color: 'var(--signal-coverage)' },
    { angle: 126,  label: 'drift',      color: 'var(--signal-drift)' },
    { angle: 198,  label: 'dead code',  color: 'var(--signal-dead)' },
  ]
  const cx = 200, cy = 200, ringR = 130
  return (
    <svg viewBox="0 0 400 400" className="w-full h-auto">
      <defs>
        <radialGradient id="oc" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%"  stopColor="var(--brand)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Center glow */}
      <circle cx={cx} cy={cy} r={170} fill="url(#oc)" />
      {/* Concentric rings */}
      <circle cx={cx} cy={cy} r={170} stroke="rgba(15,14,12,0.06)" strokeWidth={1} fill="none" />
      <circle cx={cx} cy={cy} r={ringR} stroke="rgba(5,150,105,0.18)" strokeWidth={1} fill="none" strokeDasharray="3 5" />
      <circle cx={cx} cy={cy} r={80}    stroke="rgba(15,14,12,0.06)" strokeWidth={1} fill="none" />

      {/* Lines from center to each worker */}
      {workers.map((w, i) => {
        const a = (w.angle * Math.PI) / 180
        const x = cx + Math.cos(a) * ringR
        const y = cy + Math.sin(a) * ringR
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(15,14,12,0.08)" strokeWidth={1} />
      })}

      {/* Core node */}
      <circle cx={cx} cy={cy} r={42} fill="white" stroke="rgba(15,14,12,0.12)" strokeWidth={1} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="var(--font-bricolage)" fontSize="14" fontWeight="500" fill="var(--ink)">
        codebase
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize="9" letterSpacing="1" fill="var(--ink-muted)">
        EMBEDDINGS
      </text>

      {/* Worker nodes */}
      {workers.map((w, i) => {
        const a = (w.angle * Math.PI) / 180
        const x = cx + Math.cos(a) * ringR
        const y = cy + Math.sin(a) * ringR
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={20} fill={w.color} opacity={0.12} />
            <circle cx={x} cy={y} r={6} fill={w.color} />
            <text
              x={x} y={y - 28}
              textAnchor="middle"
              fontFamily="var(--font-geist-mono)" fontSize="9" letterSpacing="1.2"
              fill={w.color}
              style={{ textTransform: 'uppercase' }}
            >
              {w.label}
            </text>
          </g>
        )
      })}

      {/* Tiny dot constellation in the corners */}
      {[
        [40, 60, 'var(--brand-3)'], [360, 80, 'var(--brand-2)'],
        [50, 340, 'var(--brand)'],  [350, 360, 'var(--brand-3)'],
      ].map(([x, y, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r={2.5} fill={c as string} opacity={0.6} />
      ))}
    </svg>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="w-full bg-[var(--canvas)]">

      <MarketingNav />

      {/* ═══════════════════════════════════════════════════════════════════
          HERO — three glowing blobs + gradient headline + dashboard preview
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative px-6 sm:px-10 pt-20 pb-32 sm:pt-28 overflow-hidden">
        <div className="hero-blobs">
          <div className="blob indigo" />
          <div className="blob violet" />
          <div className="blob cyan" />
        </div>
        <div className="absolute inset-0 dot-grid pointer-events-none opacity-60" />

        {/* Diagnostic scan beam — sweeps top-to-bottom, repeating */}
        <div className="scan-beam" />

        {/* Floating crosshair markers — drift upward like readings on a monitor */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => {
            const left = `${12 + ((i * 13.7) % 76)}%`
            const size = 10 + (i % 3) * 4
            const dur  = `${18 + (i % 5) * 4}s`
            const delay = `${(i * 2.3) % 12}s`
            const opacity = 0.12 + (i % 3) * 0.04
            return (
              <svg
                key={i}
                className="absolute"
                width={size} height={size}
                viewBox="0 0 16 16"
                style={{
                  left,
                  bottom: '-20px',
                  opacity,
                  animation: `float-up ${dur} linear ${delay} infinite`,
                }}
              >
                {/* Crosshair: horizontal + vertical hairlines, tiny center dot */}
                <line x1="0" y1="8" x2="16" y2="8" stroke="var(--brand)" strokeWidth="0.5" />
                <line x1="8" y1="0" x2="8" y2="16" stroke="var(--brand)" strokeWidth="0.5" />
                <circle cx="8" cy="8" r="1.5" fill="none" stroke="var(--brand)" strokeWidth="0.5" />
              </svg>
            )
          })}
        </div>

        <div className="relative max-w-6xl mx-auto">

          {/* Eyebrow with two badges */}
          <div className="rise-in flex items-center gap-2 mb-8 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-white/80 backdrop-blur border border-[var(--rule)] rounded-full pl-2 pr-3 py-1" style={{ boxShadow: 'var(--shadow-soft)' }}>
              <span className="relative flex w-1.5 h-1.5 ml-1">
                <span className="absolute inset-0 rounded-full opacity-50 heartbeat" style={{ background: 'var(--positive)' }} />
                <span className="absolute inset-0 rounded-full" style={{ background: 'var(--positive)' }} />
              </span>
              <span className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">Online · v0.6</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-tech text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full" style={{ background: 'var(--brand-3-light)', color: 'var(--brand-3)' }}>
              <Cpu className="w-3 h-3" />
              MCP-ready
            </span>
            <span className="inline-flex items-center gap-1.5 font-tech text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full" style={{ background: 'var(--signal-coverage-bg)', color: 'var(--signal-coverage)' }}>
              <Sparkles className="w-3 h-3" />
              Free for public repos
            </span>
          </div>

          <h1 className="rise-in rise-in-1 font-display text-[var(--ink)] text-5xl sm:text-7xl lg:text-[7.25rem] leading-[0.95] tracking-tighter font-medium max-w-5xl">
            Most code tools <span className="italic text-[var(--ink-muted)]">nag</span>.
            <br />
            We <span className="italic tri-gradient brand-gradient-animated">diagnose</span>.
          </h1>

          <div className="rise-in rise-in-2 mt-8 max-w-3xl">
            <PulseLine className="h-10 w-full" />
          </div>

          <p className="rise-in rise-in-3 mt-8 text-lg sm:text-xl text-[var(--ink-soft)] max-w-2xl leading-relaxed">
            CodePulse fans five specialist workers across every commit — complexity, dead code,
            drift, coverage, AI review — then hands the data to agents you can <em>actually argue with</em>.
          </p>

          <div className="rise-in rise-in-4 mt-10">
            <HeroForm />
            <div className="mt-5 flex items-center gap-x-6 gap-y-2 flex-wrap font-tech text-[11px] text-[var(--ink-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--brand)' }} />
                14.2s median analysis
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--brand-2)' }} />
                pgvector drift
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--brand-3)' }} />
                socket.io live updates
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--positive)' }} />
                no install required
              </span>
            </div>
          </div>

          {/* Dashboard preview, generous spacing */}
          <div className="mt-28 sm:mt-36">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <LiveTicker />

      {/* ═══════════════════════════════════════════════════════════════════
          STATS — color-tinted cards with shadows
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="px-6 sm:px-10 py-20">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { to: 12847,    label: 'Repositories examined', tint: 'var(--brand-light)',           color: 'var(--brand)' },
            { to: 0,        custom: '4.2M', label: 'Lines analyzed',  tint: 'var(--signal-coverage-bg)',    color: 'var(--signal-coverage)' },
            { to: 89321,    label: 'Things to worry about', tint: 'var(--signal-vuln-bg)',        color: 'var(--signal-vuln)' },
            { to: 23, suffix: '%', label: 'Average score lift', tint: 'var(--signal-drift-bg)', color: 'var(--signal-drift)' },
          ].map((s, i) => (
            <div key={i} className="card card-hover p-6 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-50 blur-2xl pointer-events-none" style={{ background: s.tint }} />
              <div className="relative">
                <div className="font-display text-4xl sm:text-5xl tracking-tight tnum" style={{ color: s.color }}>
                  {s.custom ?? <Counter to={s.to} suffix={s.suffix ?? ''} />}
                </div>
                <div className="mt-2 text-[12px] text-[var(--ink-muted)]">{s.label}</div>
                <div className="mt-3 h-0.5 rounded-full" style={{ background: s.tint }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SIGNALS — color-tinted cards
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="signals" className="relative px-6 sm:px-10 py-32 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'var(--brand-2)' }} />

        <div className="relative max-w-6xl mx-auto">
          <SectionHeader kicker="01 / Signals" title="Five things we measure" italic="without mercy" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-20">
            {SIGNALS.map((s, i) => {
              const Icon = s.icon
              return (
                <div
                  key={s.title}
                  className="signal-card card-hover p-6 group rounded-2xl"
                  style={{ '--accent': s.color, '--accent-glow': s.bg } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between mb-5">
                    <span
                      className="inline-flex w-11 h-11 rounded-xl items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3"
                      style={{ background: s.bg, color: s.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] tnum">
                      {String(i + 1).padStart(2, '0')} · {s.weight}%
                    </span>
                  </div>
                  <h3 className="font-display text-xl text-[var(--ink)] mb-2 tracking-tight">{s.title}</h3>
                  <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed">{s.body}</p>
                  {s.detail && (
                    <p className="mt-3 font-tech text-[11px]" style={{ color: s.color }}>
                      {s.detail}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          METHOD — three numbered cards with brand gradient strip
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="method" className="px-6 sm:px-10 py-32">
        <div className="max-w-6xl mx-auto">
          <SectionHeader kicker="02 / Method" title="Three steps" italic="then it runs forever" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20">
            {METHOD.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.title} className="card card-hover p-7 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, var(--brand-3), var(--brand), var(--brand-2))' }} />
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-display text-5xl tri-gradient tracking-tight tnum">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="inline-flex w-9 h-9 rounded-xl items-center justify-center bg-[var(--brand-light)] text-[var(--brand)]">
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <h3 className="font-display text-xl text-[var(--ink)] mb-2 tracking-tight">{step.title}</h3>
                  <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed">{step.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          AGENTS — orbital diagram + agent cards alongside
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="agents" className="relative px-6 sm:px-10 py-32 overflow-hidden">
        <div className="absolute top-1/2 left-0 w-96 h-96 rounded-full opacity-18 blur-3xl pointer-events-none" style={{ background: 'var(--brand)' }} />

        <div className="relative max-w-6xl mx-auto">
          <SectionHeader kicker="03 / Agents" title="A team of" italic="opinionated specialists" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-20 items-center">
            {/* Orbital diagram */}
            <div className="lg:col-span-5">
              <div className="card p-6 relative overflow-hidden">
                <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-4">
                  Pipeline · live
                </div>
                <OrbitalDiagram />
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 font-tech text-[11px] text-[var(--ink-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inset-0 rounded-full bg-[var(--positive)] opacity-50 heartbeat" />
                      <span className="absolute inset-0 rounded-full bg-[var(--positive)]" />
                    </span>
                    bullmq fan-out
                  </span>
                  <span>5 workers · 60s budget</span>
                  <span>pgvector embeddings</span>
                  <span>socket.io stream</span>
                </div>
              </div>
            </div>

            {/* Agent cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AGENTS.map((a) => {
                const Icon = a.icon
                return (
                  <div key={a.name} className="card card-hover p-5 group">
                    <div className="flex items-start gap-3">
                      <span
                        className="shrink-0 inline-flex w-10 h-10 rounded-xl items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3"
                        style={{ background: a.bg, color: a.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-0.5">
                          {a.role}
                        </div>
                        <h3 className="font-display text-lg text-[var(--ink)] tracking-tight">{a.name}</h3>
                      </div>
                    </div>
                    <p className="font-display italic text-[13px] mt-3" style={{ color: a.color }}>
                      &ldquo;{a.quote}&rdquo;
                    </p>
                    <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed mt-2">{a.body}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="px-6 sm:px-10 py-32">
        <div className="max-w-6xl mx-auto">
          <SectionHeader kicker="04 / Q&A" title="Questions you'll ask" italic="answered in advance" />

          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-4">
            {FAQ.map((item) => (
              <div key={item.q} className="card faq-card p-6">
                <h3 className="font-display text-lg text-[var(--ink)] tracking-tight mb-3">
                  {item.q}
                </h3>
                <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CTA — three-blob halo, big headline
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative px-6 sm:px-10 py-40 overflow-hidden">
        <div className="hero-blobs">
          <div className="blob indigo" />
          <div className="blob violet" />
          <div className="blob cyan" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="font-display text-5xl sm:text-7xl lg:text-[6.5rem] leading-[0.95] tracking-tighter text-[var(--ink)] font-medium">
            Show us your <span className="italic tri-gradient brand-gradient-animated">worst</span> repo.
          </h2>
          <p className="mt-8 text-lg text-[var(--ink-soft)] max-w-xl mx-auto">
            Free for public repositories. No credit card. We will judge — but kindly,
            and with footnotes.
          </p>
          <div className="mt-12 inline-flex items-center gap-3 flex-wrap justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white rounded-full px-6 py-3 transition-all hover:brightness-110 cta-glow"
              style={{
                background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
              }}
            >
              Open dashboard <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/pricing"
              className="text-[14px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors px-3 py-3"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER — brand section + link columns + bottom bar
          ═══════════════════════════════════════════════════════════════════ */}
      <footer>

        {/* ── Brand section ──────────────────────────────────────────────── */}
        <div className="relative px-6 sm:px-10 py-14 overflow-hidden">
          {/* Faint brand glow, left-anchored so it doesn't fight with the hero */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 55% 70% at 0% 60%, rgba(5,150,105,0.05), transparent 55%)' }} />

          <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left — wordmark, tagline, CTAs */}
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
                <BrandMark className="w-8 h-8" />
                <span className="font-display text-2xl font-semibold text-[var(--ink)] tracking-tight">codepulse</span>
              </Link>
              <p className="text-[15px] text-[var(--ink-muted)] leading-relaxed max-w-sm">
                Codebase health monitoring for teams that ship. Five signals,
                one score, AI agents you can actually argue with.
              </p>
              <div className="flex items-center gap-3 mt-6 flex-wrap">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white rounded-full px-4 py-2 hover:brightness-110 transition-all"
                  style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))', boxShadow: '0 1px 3px rgba(5,150,105,0.3), 0 4px 12px rgba(5,150,105,0.15)' }}
                >
                  Open dashboard <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--rule)] rounded-full px-4 py-2 hover:border-[var(--rule-strong)] bg-white transition-all"
                >
                  <GithubIcon className="w-3.5 h-3.5" /> View on GitHub
                </a>
              </div>
            </div>

            {/* Right — ECG line + three quick-stat pills */}
            <div>
              <PulseLine className="h-10 w-full mb-5 opacity-50" />
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Workers', value: '5 parallel' },
                  { label: 'Median run', value: '14.2 s'   },
                  { label: 'Public repos', value: 'Free'   },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl border border-[var(--rule)] bg-[var(--surface)]">
                    <div className="font-display text-[17px] font-medium text-[var(--ink)] tracking-tight leading-snug">{s.value}</div>
                    <div className="font-tech text-[9px] uppercase tracking-[0.15em] text-[var(--ink-muted)] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Link columns ───────────────────────────────────────────────── */}
        <div className="px-6 sm:px-10 py-10">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            <FooterCol title="Product" links={[
              { href: '#signals', label: 'Signals'  },
              { href: '#method',  label: 'Method'   },
              { href: '#agents',  label: 'Agents'   },
              { href: '/pricing', label: 'Pricing'  },
            ]} />
            <FooterCol title="Resources" links={[
              { href: '/dashboard', label: 'Dashboard'    },
              { href: '#',          label: 'Docs'         },
              { href: '#',          label: 'MCP server'   },
              { href: '#',          label: 'Changelog'    },
            ]} />
            <FooterCol title="Company" links={[
              { href: '#', label: 'About'   },
              { href: '#', label: 'Blog'    },
              { href: '#', label: 'Privacy' },
              { href: '#', label: 'Terms'   },
            ]} />
            <FooterCol title="Ecosystem" links={[
              { href: '#', label: 'Status page'    },
              { href: '#', label: 'Roadmap'        },
              { href: '#', label: 'Integrations'   },
              { href: '#', label: 'Open source'    },
            ]} />
          </div>
        </div>

        {/* ── Bottom bar ─────────────────────────────────────────────────── */}
        <div className="px-6 sm:px-10 py-5">
          <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-[var(--positive)] opacity-50 heartbeat" />
                <span className="absolute inset-0 rounded-full bg-[var(--positive)]" />
              </span>
              <span className="font-tech text-[11px] text-[var(--ink-subtle)]">All systems operational</span>
            </div>

            <span className="font-tech text-[11px] text-[var(--ink-subtle)]">
              © {new Date().getFullYear()} CodePulse · Built with too much coffee · v0.6
            </span>

            {/* Social links */}
            <div className="flex items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="text-[var(--ink-subtle)] hover:text-[var(--ink)] transition-colors"
              >
                <GithubIcon className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X / Twitter"
                className="text-[var(--ink-subtle)] hover:text-[var(--ink)] transition-colors"
              >
                <XIcon className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        </div>

      </footer>
    </div>
  )
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <div className="font-display text-[13px] font-medium text-[var(--ink)] mb-4 tracking-tight">
        {title}
      </div>
      <ul className="space-y-2.5">
        {links.map(l => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-[13px] text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors leading-none"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Section header ────────────────────────────────────────────────────────
function SectionHeader({
  kicker, title, italic,
}: { kicker: string; title: string; italic?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-baseline">
      <div className="md:col-span-3 font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
        {kicker}
      </div>
      <h2 className="md:col-span-9 font-display text-3xl sm:text-5xl lg:text-6xl leading-[1] tracking-tighter text-[var(--ink)] font-medium max-w-3xl">
        {title}
        {italic && (
          <>
            {' '}
            <span className="italic tri-gradient">{italic}.</span>
          </>
        )}
      </h2>
    </div>
  )
}

// ─── Data ──────────────────────────────────────────────────────────────────
const SIGNALS = [
  { title: 'Cyclomatic complexity', weight: 25, icon: Zap,
    color: 'var(--signal-complexity)', bg: 'var(--signal-complexity-bg)',
    body: 'Per-function escomplex with deltas. We surface the function that grew worse — by name, by line, by how much.',
    detail: 'src/auth.ts:142 · 23 → 31' },
  { title: 'Vulnerabilities', weight: 25, icon: ShieldAlert,
    color: 'var(--signal-vuln)', bg: 'var(--signal-vuln-bg)',
    body: 'Live npm audit on every dependency. Critical issues count 10× over moderate, because they should.',
    detail: 'lodash@4.17.20 · CVE-2021-23337' },
  { title: 'Test coverage', weight: 20, icon: TestTube2,
    color: 'var(--signal-coverage)', bg: 'var(--signal-coverage-bg)',
    body: 'Lcov, parsed and trended. The file that quietly slipped under your threshold? We saw it.',
    detail: 'billing.ts · 91% → 78%' },
  { title: 'Dead code', weight: 15, icon: Ghost,
    color: 'var(--signal-dead)', bg: 'var(--signal-dead-bg)',
    body: 'Tree-shakes the import graph until only what you actually use remains. The graveyard, mapped.',
    detail: '12 dead exports · 3 stale' },
  { title: 'Architectural drift', weight: 15, icon: Radar,
    color: 'var(--signal-drift)', bg: 'var(--signal-drift-bg)',
    body: 'pgvector cosine similarity flags files that no longer fit their module. The signal your linter never gives.',
    detail: 'cosine median · 0.31' },
  { title: 'Weighted health score', weight: 100, icon: Activity,
    color: 'var(--brand)', bg: 'var(--brand-light)',
    body: 'A 0–100 composite, tunable. Streams to your dashboard before CI finishes. Yes, really.',
    detail: '14.2s median analysis' },
]

const METHOD = [
  { title: 'Connect', icon: GitPullRequest,
    body: 'Paste a public URL or install the GitHub App. Both paths converge on the same dashboard, no duplicates.' },
  { title: 'Examine', icon: Workflow,
    body: 'Five workers analyze in parallel via BullMQ. The aggregator computes a weighted score and writes a snapshot.' },
  { title: 'Attend',  icon: Bot,
    body: 'Resident AI agents read findings, walk back commits, explain regressions on demand. Watch tool calls live.' },
]

const AGENTS = [
  { role: 'Generalist',    name: 'The Resident',  icon: MessageSquare,
    color: 'var(--brand)',          bg: 'var(--brand-light)',
    body: 'Tool-calling chat. Searches embeddings, reads files, answers with citations.',
    quote: 'Show your work.' },
  { role: 'Diagnostician', name: 'Root-Cause', icon: Bot,
    color: 'var(--signal-vuln)',    bg: 'var(--signal-vuln-bg)',
    body: 'Walks back through commits, reads diffs, points to the line that broke a metric.',
    quote: 'It started at 4 a.m. on a Tuesday.' },
  { role: 'Disputants',    name: 'Pro & Con',  icon: Workflow,
    color: 'var(--signal-drift)',   bg: 'var(--signal-drift-bg)',
    body: 'Two personas debate a refactor for three rounds, citing real findings as evidence.',
    quote: 'Refactor. Decline. You decide.' },
  { role: 'Cartographer',  name: 'The Tour',   icon: Radar,
    color: 'var(--signal-coverage)', bg: 'var(--signal-coverage-bg)',
    body: 'Generates a five-step tour of any unfamiliar codebase, narrating risky areas along the way.',
    quote: 'Begin at the entry point.' },
]

const FAQ = [
  { q: 'Do I need to install anything?',
    a: 'No. Paste a public GitHub URL and you have a dashboard in thirty seconds. The App is optional and added later for live monitoring on every push.' },
  { q: 'Where does my code go?',
    a: "Nowhere it shouldn't. We store embeddings (1,536-dim vectors) and metric snapshots — never source. Files are fetched on-demand for AI tool calls and discarded after the response." },
  { q: 'How is the score calculated?',
    a: 'A weighted formula: complexity 25%, vulnerabilities 25%, coverage 20%, dead code 15%, drift 15%. Components normalized to 0–100. Weights tunable per repo.' },
  { q: 'What is "drift", really?',
    a: 'Cosine similarity between a file embedding and its top-five neighbours. Below 0.72 the file no longer fits its module — the quiet signal your linter never gives.' },
  { q: 'Private repositories?',
    a: 'Yes. Install the GitHub App, grant access, and the same pipeline runs against private code. Pro plan covers unlimited private analysis.' },
  { q: 'Can I tune what counts?',
    a: 'Per-repo settings let you change the drift threshold, the digest cadence, and the weights themselves. We apply your tune at read-time, no re-run needed.' },
]

// Avoid unused import errors for icons we may toggle in/out
void ArrowDownRight

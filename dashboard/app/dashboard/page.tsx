'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { getRepos } from '@/lib/api'
import type { Repo } from '@/lib/schema'
import Link from 'next/link'
import { Search, ArrowUpRight } from 'lucide-react'
import { AnalyzeUrlForm } from '@/components/AnalyzeUrlForm'
import { DemoRepoButton } from '@/components/DemoRepoButton'
import { InstallGithubApp } from '@/components/InstallGithubApp'

// Modern minimal repo list. Hairline rows over cards — we have a lot of repos to
// fit and a tabular layout reads faster than a card grid.
export default function DashboardPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const [query, setQuery] = useState('')

  const { data: repos, isLoading, isError } = useQuery({
    queryKey: ['repos'],
    queryFn: async () => {
      const token = await getToken()
      return getRepos(token!)
    },
    enabled: isLoaded && !!isSignedIn,
  })

  const filtered = useMemo(() => {
    if (!repos) return []
    const q = query.trim().toLowerCase()
    if (!q) return repos
    return repos.filter(r => `${r.owner}/${r.name}`.toLowerCase().includes(q))
  }, [repos, query])

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-5 h-5 border border-[var(--rule-strong)] border-t-[var(--ink)] rounded-full animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="max-w-md mx-auto text-center py-32">
        <h2 className="font-display text-2xl text-[var(--ink)] mb-2">Can&apos;t reach the API</h2>
        <p className="text-sm text-[var(--ink-muted)]">Make sure your backend is running on port 3000.</p>
      </div>
    )
  }

  // ─── Empty state ─────────────────────────────────────────────────────────
  if (!repos || repos.length === 0) {
    return (
      <div className="max-w-5xl mx-auto py-16 px-6">
        <div className="max-w-2xl">
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-6">
            — Getting started
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-[var(--ink)] tracking-tighter font-medium leading-[1]">
            Let&apos;s analyze your first repo.
          </h1>
          <p className="mt-6 text-lg text-[var(--ink-soft)] leading-relaxed">
            Pick the path that fits — paste a public URL for an instant scan, install the GitHub App for continuous monitoring, or try a demo.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              num: '01', title: 'Paste a public URL',
              body: 'Get a full health dashboard in thirty seconds. No installation.',
              action: <AnalyzeUrlForm />,
              color: 'var(--brand)', bg: 'var(--brand-light)',
            },
            {
              num: '02', title: 'Install the GitHub App',
              body: 'Continuous monitoring with PR comments on every push.',
              action: <InstallGithubApp />,
              color: 'var(--signal-drift)', bg: 'var(--signal-drift-bg)',
            },
            {
              num: '03', title: 'Try the demo',
              body: 'Skip the wait — a pre-seeded repo with snapshots and AI insights.',
              action: <DemoRepoButton />,
              color: 'var(--signal-coverage)', bg: 'var(--signal-coverage-bg)',
            },
          ].map((row) => (
            <div
              key={row.title}
              className="card card-hover p-6 relative overflow-hidden"
              style={{ borderTop: `3px solid ${row.color}` }}
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-40 pointer-events-none" style={{ background: row.bg }} />
              <div className="relative min-w-0">
                <div className="font-display text-4xl tnum mb-4" style={{ color: row.color }}>{row.num}</div>
                <h3 className="font-display text-xl text-[var(--ink)] tracking-tight mb-2">{row.title}</h3>
                <p className="text-[13px] text-[var(--ink-muted)] leading-relaxed mb-5">{row.body}</p>
                {row.action}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Populated dashboard ─────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-10 py-12 w-full flex-1">
      {/* Header */}
      <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
        <div>
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">
            — Repositories
          </div>
          <h1 className="font-display text-5xl sm:text-6xl text-[var(--ink)] tracking-tighter font-medium leading-[1]">
            {repos.length} {repos.length === 1 ? 'repo' : 'repos'}
            <span className="text-[var(--ink-muted)]"> monitored</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <InstallGithubApp />
          <AnalyzeUrlForm />
        </div>
      </div>

      {/* Source counts as inline meta — no boxes */}
      <div className="flex items-center gap-8 mb-10 text-[13px]">
        <Stat label="GitHub App" value={repos.filter(r => r.source === 'github_app').length} />
        <Stat label="Public URL" value={repos.filter(r => r.source === 'public_url').length} />
        <Stat label="Demo"        value={repos.filter(r => r.source === 'demo' || r.isPublicDemo).length} />
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink-muted)] pointer-events-none" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by owner or name…"
          className="w-full bg-[var(--surface)] rounded-xl pl-9 pr-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
        />
      </div>

      {/* Repo list — tabular hairline rows */}
      {filtered.length === 0 ? (
        <p className="text-center py-20 text-sm text-[var(--ink-muted)]">
          No repositories match <span className="font-tech text-[var(--ink)]">{query}</span>.
        </p>
      ) : (
        <div>
          <div className="hidden md:grid grid-cols-[1.5fr_1.5fr_120px_120px_24px] gap-4 py-3 font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            <div>Owner</div>
            <div>Repository</div>
            <div>Source</div>
            <div>Last analyzed</div>
            <div></div>
          </div>
          {filtered.map(repo => (
            <RepoRow key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-2xl text-[var(--ink)] tnum">{value}</span>
      <span className="text-[12px] text-[var(--ink-muted)]">{label}</span>
    </div>
  )
}

function RepoRow({ repo }: { repo: Repo }) {
  const sourceLabel =
    repo.source === 'github_app' ? 'GitHub App' :
    repo.source === 'public_url' ? 'Public URL'   :
    repo.source === 'demo'       ? 'Demo'         : repo.source

  const last = repo.lastAnalyzedAt
    ? new Date(repo.lastAnalyzedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '—'

  return (
    <Link
      href={`/repos/${repo.id}`}
      className="grid grid-cols-[1fr_24px] md:grid-cols-[1.5fr_1.5fr_120px_120px_24px] gap-4 py-4 rounded-xl hover:bg-[var(--surface-2)] transition-colors items-center group px-2"
    >
      <div className="text-[14px] text-[var(--ink-muted)] truncate">
        <span className="md:hidden font-tech text-[10px] uppercase tracking-[0.2em] mr-2">Owner</span>
        {repo.owner}
      </div>
      <div className="text-[15px] text-[var(--ink)] truncate font-medium">{repo.name}</div>
      <div className="hidden md:block text-[12px] text-[var(--ink-muted)]">{sourceLabel}</div>
      <div className="hidden md:block font-tech text-[12px] text-[var(--ink-muted)] tnum">{last}</div>
      <ArrowUpRight className="w-3.5 h-3.5 text-[var(--ink-subtle)] group-hover:text-[var(--ink)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
    </Link>
  )
}

'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { getSnapshots } from '@/lib/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import HealthTrend from '@/components/HealthTrend'
import WorkerProgress from '@/components/WorkerProgress'
import FileHeatmap from '@/components/FileHeatmap'
import DriftScatter from '@/components/DriftScatter'
import InsightCards from '@/components/InsightCards'
import ChatPannel from '@/components/ChatPannel'
import RootCauseAgent from '@/components/RootCauseAgent'
import CodebaseTour from '@/components/CodebaseTour'
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

// Health-score band — only contextual color usage on the page.
function scoreColor(score: number) {
  if (score >= 80) return 'var(--positive)'
  if (score >= 60) return 'var(--ink)'
  if (score >= 40) return 'var(--warn)'
  return 'var(--negative)'
}
function scoreLabel(score: number) {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Healthy'
  if (score >= 40) return 'Needs attention'
  return 'Critical'
}

export default function Page() {
  const { id } = useParams()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()

  const handleLiveUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['snapshots', id] })
  }, [queryClient, id])

  const { data: snapshots, isLoading, isError } = useQuery({
    queryKey: ['snapshots', id],
    queryFn: async () => {
      const token = await getToken()
      return getSnapshots(id as string, token!)
    },
    enabled: isLoaded && !!isSignedIn && !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-5 h-5 border border-[var(--rule-strong)] border-t-[var(--ink)] rounded-full animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-32 text-sm text-[var(--ink-muted)]">
        Failed to load snapshots. Is the API running?
      </div>
    )
  }

  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-32">
        <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-4">
          — No data yet
        </div>
        <h2 className="font-display text-3xl text-[var(--ink)] tracking-tight mb-3">
          No snapshots yet.
        </h2>
        <p className="text-sm text-[var(--ink-muted)] mb-8">
          Push a commit to your repo to generate the first health score.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to repositories
        </Link>
      </div>
    )
  }

  const latest   = snapshots[0]
  const previous = snapshots[1]
  const color    = scoreColor(latest.healthScore)
  const label    = scoreLabel(latest.healthScore)
  const delta    = previous ? latest.healthScore - previous.healthScore : 0

  const metrics = [
    { label: 'Complexity',    value: latest.complexity.toFixed(2), hint: 'avg cyclomatic' },
    { label: 'Vulnerabilities', value: String(latest.vulnCount),    hint: 'critical / high' },
    { label: 'Coverage',      value: `${(latest.coverage * 100).toFixed(1)}%`, hint: 'lcov parsed' },
    { label: 'Drift',         value: latest.driftScore.toFixed(2),  hint: 'cosine similarity' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-10 py-12 w-full flex-1">
      {/* Top nav row */}
      <div className="flex items-center justify-between mb-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Repositories
        </Link>
        <div className="flex items-center gap-6 text-[12px]">
          <Link href={`/repos/${id}/findings`} className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
            Findings
          </Link>
          <Link href={`/repos/${id}/debate`} className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
            Debate
          </Link>
          <Link href={`/repos/${id}/settings`} className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors">
            Settings
          </Link>
        </div>
      </div>

      {/* AI insights row (kept for now — InsightCards re-styled is a separate pass) */}
      <InsightCards snapshotId={latest.id} />

      {/* Floating chat panel */}
      <ChatPannel repoId={id as string} />

      <CodebaseTour repoId={id as string} />

      {/* ─── Hero: health score + commit ─────────────────────────────────── */}
      <section className="mt-8 mb-12 grid grid-cols-1 lg:grid-cols-12 gap-y-8 lg:gap-x-12 items-end">
        <div className="lg:col-span-7">
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3 flex items-center gap-3">
            <span>Health score · {label}</span>
            <span className="text-[var(--ink-subtle)]">·</span>
            <span className="font-tech text-[var(--ink-subtle)]">{latest.commitSha.slice(0, 7)}</span>
          </div>

          <div className="flex items-baseline gap-4 flex-wrap">
            <span
              className="font-display text-[10rem] sm:text-[12rem] leading-[0.85] tracking-tighter font-medium tnum"
              style={{ color }}
            >
              {latest.healthScore.toFixed(1)}
            </span>
            <span className="text-[var(--ink-subtle)] text-2xl mb-3">/100</span>
          </div>

          {previous && (
            <div className="mt-4 inline-flex items-center gap-2 text-[13px]" style={{ color: delta > 0 ? 'var(--positive)' : delta < 0 ? 'var(--negative)' : 'var(--ink-muted)' }}>
              {delta > 0 ? <ArrowUpRight className="w-3.5 h-3.5" />
                : delta < 0 ? <ArrowDownRight className="w-3.5 h-3.5" />
                : <Minus className="w-3.5 h-3.5" />}
              <span className="font-tech tnum">
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
              </span>
              <span className="text-[var(--ink-muted)]">vs. previous push</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 lg:text-right">
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-2">
            Snapshots collected
          </div>
          <div className="font-display text-5xl text-[var(--ink)] tnum tracking-tight">
            {snapshots.length}
          </div>
        </div>
      </section>

      {/* ─── Metrics row — hairline-divided, no boxes ──────────────────── */}
      <section className="mb-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className="card p-6"
            >
              <div className="font-tech text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                {m.label}
              </div>
              <div className="font-display text-4xl text-[var(--ink)] mt-3 tnum tracking-tight">
                {m.value}
              </div>
              <div className="text-[11px] text-[var(--ink-subtle)] mt-1">{m.hint}</div>
              <div className="mt-3">
                <RootCauseAgent repoId={id as string} metric={m.label.toLowerCase()} direction="drop" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Charts grid ────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <HealthTrend snapshots={snapshots} />
        </div>
        <div className="card p-6">
          <WorkerProgress repoId={id as string} onUpdate={handleLiveUpdate} />
        </div>
        <div className="card p-6">
          <FileHeatmap snapshots={snapshots} />
        </div>
        <div className="lg:col-span-2 card p-6">
          <DriftScatter snapshots={snapshots} />
        </div>
      </section>
    </div>
  )
}

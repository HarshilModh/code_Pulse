'use client'

import { useQuery } from '@tanstack/react-query'
import { getSnapshots } from '@/lib/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import HealthTrend from '@/components/HealthTrend'
import WorkerProgress from '@/components/WorkerProgress'
import FileHeatmap from '@/components/FileHeatmap'
import DriftScatter from '@/components/DriftScatter'
import { ArrowLeft, GitCommit, TrendingUp, TrendingDown, Minus, Shield, TestTube2, Zap, Radar } from 'lucide-react'

function scoreColor(score: number) {
  if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400', glow: 'bg-emerald-500/20' }
  if (score >= 60) return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-400', glow: 'bg-blue-500/20' }
  if (score >= 40) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400', glow: 'bg-amber-500/20' }
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-400', glow: 'bg-red-500/20' }
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Healthy'
  if (score >= 40) return 'Needs attention'
  return 'Critical'
}

export default function Page() {
  const { id } = useParams()
  const { data: snapshots, isLoading, isError } = useQuery({
    queryKey: ['snapshots', id],
    queryFn: () => getSnapshots(id as string),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-32 text-zinc-400">
        Failed to load snapshots. Is the API running?
      </div>
    )
  }

  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-32">
        <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-5">
          <GitCommit className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No snapshots yet</h2>
        <p className="text-sm text-zinc-400 mb-6">Push a commit to your repo to generate the first HealthScore.</p>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to repositories
        </Link>
      </div>
    )
  }

  const latest = snapshots[0]
  const previous = snapshots[1]
  const color = scoreColor(latest.healthScore)
  const label = scoreLabel(latest.healthScore)
  const delta = previous ? latest.healthScore - previous.healthScore : 0

  const metrics = [
    { label: 'Complexity', value: latest.complexity.toFixed(2), icon: Zap, hint: 'cyclomatic avg', tone: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Vulnerabilities', value: latest.vulnCount, icon: Shield, hint: 'CVEs found', tone: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Coverage', value: `${(latest.coverage * 100).toFixed(1)}%`, icon: TestTube2, hint: 'test coverage', tone: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Drift Score', value: latest.driftScore.toFixed(2), icon: Radar, hint: 'architectural fit', tone: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  ]

  return (
    <div>
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> All repositories
      </Link>

      {/* Hero — HealthScore */}
      <div className="relative overflow-hidden bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-8 mb-6">
        <div className={`absolute -top-24 -right-24 w-64 h-64 ${color.glow} blur-[80px] rounded-full`} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`inline-flex items-center gap-1.5 ${color.bg} ${color.border} border rounded-full px-2.5 py-0.5`}>
                <div className={`w-1.5 h-1.5 rounded-full ${color.dot} animate-pulse`} />
                <span className={`text-xs font-medium ${color.text}`}>{label}</span>
              </div>
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <GitCommit className="w-3 h-3" />
                {latest.commitSha.slice(0, 7)}
              </span>
            </div>
            <p className="text-sm text-zinc-400 mb-2">Health Score</p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className={`text-6xl font-bold ${color.text} tracking-tight`}>
                {latest.healthScore.toFixed(1)}
              </span>
              <span className="text-zinc-500 text-lg">/ 100</span>
              {previous && delta !== 0 && (
                <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {delta > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {Math.abs(delta).toFixed(1)}
                </span>
              )}
              {previous && delta === 0 && (
                <span className="inline-flex items-center gap-0.5 text-sm font-medium text-zinc-500">
                  <Minus className="w-4 h-4" /> no change
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Snapshots</p>
            <p className="text-2xl font-semibold text-white">{snapshots.length}</p>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {metrics.map((m) => (
          <div key={m.label} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 hover:border-zinc-700 transition-colors">
            <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center mb-3`}>
              <m.icon className={`w-4 h-4 ${m.tone}`} />
            </div>
            <p className="text-xs text-zinc-500 mb-0.5">{m.label}</p>
            <p className="text-xl font-semibold text-white">{m.value}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{m.hint}</p>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <HealthTrend snapshots={snapshots} />
        </div>
        <WorkerProgress repoId={id as string} />
        <FileHeatmap snapshots={snapshots} />
        <div className="lg:col-span-2">
          <DriftScatter snapshots={snapshots} />
        </div>
      </div>
    </div>
  )
}

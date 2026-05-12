'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { getInsights } from '@/lib/api'
import { AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react'

function Skeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      {[0, 1, 2].map(i => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="h-3 bg-[var(--surface-2)] rounded w-1/3 mb-3" />
          <div className="space-y-2">
            <div className="h-2.5 bg-[var(--surface-2)] rounded" />
            <div className="h-2.5 bg-[var(--surface-2)] rounded w-4/5" />
            <div className="h-2.5 bg-[var(--surface-2)] rounded w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function InsightCards({ snapshotId }: { snapshotId: string }) {
  const { getToken } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['insights', snapshotId],
    queryFn: async () => {
      const token = await getToken()
      return getInsights(snapshotId, token!)
    },
    refetchInterval: (query) => (query.state.data?.pending ? 5000 : false),
  })

  if (isLoading || !data || data.pending) return <Skeleton />

  const topRisks    = (data.topRisks    ?? []) as string[]
  const improvements = (data.improvements ?? []) as string[]
  const nextAction  = data.nextAction ?? ''

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      <div className="card p-4" style={{ borderTop: '2px solid var(--signal-vuln)' }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-[var(--signal-vuln)]" />
          <span className="font-tech text-[11px] font-medium text-[var(--signal-vuln)] uppercase tracking-wider">Top Risks</span>
        </div>
        <ul className="space-y-1.5">
          {topRisks.map((risk, i) => (
            <li key={i} className="text-[13px] text-[var(--ink-soft)] flex gap-2 leading-relaxed">
              <span className="text-[var(--signal-vuln)] shrink-0 mt-0.5">·</span>
              {risk}
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4" style={{ borderTop: '2px solid var(--positive)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-3.5 h-3.5 text-[var(--positive)]" />
          <span className="font-tech text-[11px] font-medium text-[var(--positive)] uppercase tracking-wider">Improvements</span>
        </div>
        <ul className="space-y-1.5">
          {improvements.map((imp, i) => (
            <li key={i} className="text-[13px] text-[var(--ink-soft)] flex gap-2 leading-relaxed">
              <span className="text-[var(--positive)] shrink-0 mt-0.5">·</span>
              {imp}
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4" style={{ borderTop: '2px solid var(--brand)' }}>
        <div className="flex items-center gap-2 mb-3">
          <ArrowRight className="w-3.5 h-3.5 text-[var(--brand)]" />
          <span className="font-tech text-[11px] font-medium text-[var(--brand)] uppercase tracking-wider">Next Action</span>
        </div>
        <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed">{nextAction}</p>
      </div>
    </div>
  )
}

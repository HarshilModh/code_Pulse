'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getFindings } from '@/lib/api'
import FindingCard from '@/components/FindingCard'
import type { Finding } from '@/lib/schema'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

function FilterSelect({ value, onChange, children }: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="font-tech text-[12px] bg-[var(--surface)] border border-[var(--rule)] text-[var(--ink-muted)] rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[var(--brand)]/20 transition-all hover:border-[var(--rule-strong)] cursor-pointer"
    >
      {children}
    </select>
  )
}

export default function RepoFindingsPage() {
  const { id } = useParams()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()

  const [status, setStatus]     = useState('')
  const [type, setType]         = useState('')
  const [severity, setSeverity] = useState('')

  const { data: findings = [], isLoading } = useQuery({
    queryKey: ['findings', { status, type, severity, repoId: id }],
    queryFn: async () => {
      const token = await getToken()
      return getFindings(
        {
          // Scoped to this repo — avoids loading findings from other repos
          repoId:   id as string,
          status:   status   || undefined,
          type:     type     || undefined,
          severity: severity || undefined,
        },
        token!
      )
    },
    enabled: isLoaded && !!isSignedIn && !!id,
  })

  function handleStatusChange(findingId: string, newStatus: string) {
    queryClient.setQueryData(
      ['findings', { status, type, severity, repoId: id }],
      (old: Finding[] | undefined) =>
        (old ?? []).map(f => f.id === findingId ? { ...f, status: newStatus } : f)
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-10 py-12 w-full flex-1">
      {/* Back link */}
      <Link
        href={`/repos/${id}`}
        className="inline-flex items-center gap-1.5 font-tech text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors mb-8"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
      </Link>

      {/* Page header */}
      <div className="mb-10">
        <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">
          — Findings
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-display text-5xl text-[var(--ink)] tracking-tighter font-medium leading-[1]">
            Repo findings
          </h1>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--signal-vuln-bg)]">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--signal-vuln)]" />
            <span className="font-tech text-[11px] text-[var(--signal-vuln)] uppercase tracking-wide">
              Auto-detected on every push
            </span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-8 flex-wrap items-center">
        <FilterSelect value={status} onChange={setStatus}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="wont_fix">Won&apos;t fix</option>
        </FilterSelect>

        <FilterSelect value={type} onChange={setType}>
          <option value="">All types</option>
          <option value="vuln">Vulnerability</option>
          <option value="complexity">Complexity</option>
          <option value="drift">Drift</option>
          <option value="dead_code">Dead code</option>
          <option value="ai_review">AI review</option>
        </FilterSelect>

        <FilterSelect value={severity} onChange={setSeverity}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </FilterSelect>

        {!isLoading && (
          <span className="ml-auto font-tech text-[12px] text-[var(--ink-muted)]">
            {findings.length} finding{findings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-5 h-5 border border-[var(--rule-strong)] border-t-[var(--ink)] rounded-full animate-spin" />
        </div>
      )}

      {/* showRepo is false — repo is already implied by the URL */}
      <div className="space-y-3">
        {findings.map((f: Finding) => (
          <FindingCard
            key={f.id}
            finding={f}
            showRepo={false}
            onStatusChange={handleStatusChange}
          />
        ))}

        {!isLoading && findings.length === 0 && (
          <div className="text-center py-20">
            <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-subtle)] mb-3">
              — Empty
            </div>
            <p className="text-[14px] text-[var(--ink-muted)]">No findings match the current filters.</p>
          </div>
        )}
      </div>
    </div>
  )
}

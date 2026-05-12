"use client"
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Radio, GitCommit } from 'lucide-react'

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3000'

type HealthUpdate = {
  repoId: string
  commitSha: string
  healthScore: number
  complexity: number
  vulnCount: number
  deadCode: number
  coverage: number
  driftScore: number
}

export default function WorkerProgress({ repoId, onUpdate }: { repoId: string; onUpdate?: (data: HealthUpdate) => void }) {
  const [update, setUpdate] = useState<HealthUpdate | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = io(SOCKET_URL)
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('health-update', (data: HealthUpdate) => {
      if (data.repoId === repoId) {
        setUpdate(data)
        onUpdate?.(data)
      }
    })
    return () => { socket.disconnect() }
  }, [repoId, onUpdate])

  const metrics = update ? [
    { label: 'Complexity',     value: update.complexity.toFixed(2) },
    { label: 'Vulnerabilities', value: update.vulnCount },
    { label: 'Coverage',       value: `${(update.coverage * 100).toFixed(1)}%` },
    { label: 'Dead Code',      value: `${(update.deadCode * 100).toFixed(1)}%` },
    { label: 'Drift',          value: `${(update.driftScore * 100).toFixed(1)}%` },
  ] : []

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${connected ? 'bg-[var(--brand-light)]' : 'bg-[var(--surface-2)]'}`}>
            <Radio className={`w-4 h-4 ${connected ? 'text-[var(--brand)]' : 'text-[var(--ink-muted)]'}`} />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-medium text-[var(--ink)]">Live Updates</h3>
            <p className={`font-tech text-[10px] ${connected ? 'text-[var(--brand)]' : 'text-[var(--ink-muted)]'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
        </div>
        {connected && (
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
        )}
      </div>

      {!update ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-[var(--brand)]/10 blur-xl rounded-full" />
            <Radio className="relative w-8 h-8 text-[var(--ink-subtle)]" />
          </div>
          <p className="text-[13px] text-[var(--ink-muted)]">Waiting for next push…</p>
          <p className="font-tech text-[11px] text-[var(--ink-subtle)] mt-1">Metrics will appear in real time</p>
        </div>
      ) : (
        <div>
          <div className="mb-4 pb-4 border-b border-[var(--rule)]">
            <div className="flex items-center gap-1.5 font-tech text-[11px] text-[var(--ink-muted)] mb-1.5">
              <GitCommit className="w-3 h-3" />
              {update.commitSha.slice(0, 7)}
            </div>
            <p className="font-display text-4xl font-medium tnum tracking-tight" style={{ color: 'var(--brand)' }}>
              {update.healthScore.toFixed(1)}
            </p>
            <p className="font-tech text-[11px] text-[var(--ink-muted)]">health score</p>
          </div>
          <div className="space-y-2.5">
            {metrics.map((m) => (
              <div key={m.label} className="flex justify-between text-[13px]">
                <span className="text-[var(--ink-muted)]">{m.label}</span>
                <span className="font-medium tnum text-[var(--ink)]">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

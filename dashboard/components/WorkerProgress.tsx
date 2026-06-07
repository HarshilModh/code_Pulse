"use client"
  import { useEffect, useState } from 'react'
  import { io } from 'socket.io-client'
  import { GitCommit } from 'lucide-react'

  const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3000'

  const WORKERS = ['complexity', 'deadcode', 'vuln', 'coverage', 'drift'] as const
  type WorkerName = typeof WORKERS[number]
  type WorkerPhase = 'idle' | 'running' | 'done'

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

  type WorkerEvent = {
    repoId: string
    commitSha: string
    worker: string
    phase: 'start' | 'done'
  }

  export default function WorkerProgress({ repoId, onUpdate }: { repoId: string; onUpdate?: (data: HealthUpdate) => void }) {
    const [phases, setPhases] = useState<Record<WorkerName, WorkerPhase>>({
      complexity: 'idle', deadcode: 'idle', vuln: 'idle', coverage: 'idle', drift: 'idle'
    })
    const [healthUpdate, setHealthUpdate] = useState<HealthUpdate | null>(null)
    const [connected, setConnected] = useState(false)

    useEffect(() => {
      const socket = io(SOCKET_URL)
      socket.on('connect', () => setConnected(true))
      socket.on('disconnect', () => setConnected(false))

      socket.on('worker-event', (data: WorkerEvent) => {
        if (data.repoId !== repoId) return
        const name = data.worker as WorkerName
        if (!WORKERS.includes(name)) return
        setPhases(prev => ({
          ...prev,
          [name]: data.phase === 'start' ? 'running' : 'done'
        }))
      })

      socket.on('health-update', (data: HealthUpdate) => {
        if (data.repoId !== repoId) return
        setHealthUpdate(data)
        onUpdate?.(data)
        // reset pipeline after a short delay so it's ready for the next push
        setTimeout(() => setPhases({ complexity: 'idle', deadcode: 'idle', vuln: 'idle', coverage: 'idle', drift: 'idle' }), 4000)
      })

      return () => { socket.disconnect() }
    }, [repoId, onUpdate])

    const phaseColor = (p: WorkerPhase) => {
      if (p === 'done')    return 'var(--brand)'
      if (p === 'running') return 'var(--brand)'
      return 'var(--ink-subtle)'
    }

    const labels: Record<WorkerName, string> = {
      complexity: 'Complexity', deadcode: 'Dead Code',
      vuln: 'Vulns', coverage: 'Coverage', drift: 'Drift'
    }

    return (
      <div className="h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-[15px] font-medium text-[var(--ink)]">Pipeline</h3>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${connected ? 'bg-[var(--brand)] animate-pulse' : 'bg-[var(--ink-subtle)]'}`} />
            <span className="font-tech text-[10px] text-[var(--ink-muted)]">{connected ? 'live' : 'offline'}</span>
          </div>
        </div>

        {/* SVG Pipeline */}
        <svg viewBox="0 0 260 160" className="w-full mb-4" style={{ overflow: 'visible' }}>
          {WORKERS.map((w, i) => {
            const y = i * 28 + 14
            const phase = phases[w]
            const color = phaseColor(phase)

            return (
              <g key={w}>
                {/* track line */}
                <line x1="60" y1={y} x2="220" y2={y} stroke="var(--rule)" strokeWidth="1.5" strokeDasharray="4 3" />
                {/* label */}
                <text x="55" y={y + 4} textAnchor="end" fontSize="9" fill="var(--ink-muted)" fontFamily="monospace">
                  {labels[w]}
                </text>
                {/* done fill */}
                {phase === 'done' && (
                  <line x1="60" y1={y} x2="220" y2={y} stroke={color} strokeWidth="1.5" opacity="0.4" />
                )}
                {/* animated token */}
                {phase === 'running' && (
                  <circle r="4" fill={color} opacity="0.9">
                    <animateMotion dur="1.2s" repeatCount="indefinite"
                      path={`M60,${y} L220,${y}`} />
                  </circle>
                )}
                {/* done checkmark dot */}
                {phase === 'done' && (
                  <circle cx="220" cy={y} r="4" fill={color} />
                )}
                {/* idle dot */}
                {phase === 'idle' && (
                  <circle cx="60" cy={y} r="3" fill="var(--rule)" />
                )}
              </g>
            )
          })}

          {/* Aggregator box */}
          <rect x="224" y="4" width="32" height="152" rx="4"
            fill={healthUpdate ? 'var(--brand)' : 'var(--surface-2)'}
            opacity={healthUpdate ? '0.15' : '0.5'}
            stroke={healthUpdate ? 'var(--brand)' : 'var(--rule)'}
            strokeWidth="1"
          />
          <text x="240" y="84" textAnchor="middle" fontSize="8" fill="var(--ink-muted)"
            fontFamily="monospace" transform="rotate(-90, 240, 84)">
            aggregator
          </text>
        </svg>

        {/* Health score result */}
        {healthUpdate ? (
          <div className="pt-3 border-t border-[var(--rule)]">
            <div className="flex items-center gap-1.5 font-tech text-[11px] text-[var(--ink-muted)] mb-1">
              <GitCommit className="w-3 h-3" />
              {healthUpdate.commitSha.slice(0, 7)}
            </div>
            <p className="font-display text-3xl font-medium tnum" style={{ color: 'var(--brand)' }}>
              {healthUpdate.healthScore.toFixed(1)}
            </p>
            <p className="font-tech text-[11px] text-[var(--ink-muted)]">health score</p>
          </div>
        ) : (
          <p className="text-[12px] text-[var(--ink-muted)] text-center">Waiting for next push…</p>
        )}
      </div>
    )
  }
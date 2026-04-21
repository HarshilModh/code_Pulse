'use client'

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

export default function WorkerProgress({ repoId }: { repoId: string }) {
  const [update, setUpdate] = useState<HealthUpdate | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = io(SOCKET_URL)
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('health-update', (data: HealthUpdate) => {
      if (data.repoId === repoId) setUpdate(data)
    })
    return () => { socket.disconnect() }
  }, [repoId])

  const metrics = update ? [
    { label: 'Complexity', value: update.complexity.toFixed(2) },
    { label: 'Vulnerabilities', value: update.vulnCount },
    { label: 'Coverage', value: `${(update.coverage * 100).toFixed(1)}%` },
    { label: 'Dead Code', value: `${(update.deadCode * 100).toFixed(1)}%` },
    { label: 'Drift', value: `${(update.driftScore * 100).toFixed(1)}%` },
  ] : []

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${connected ? 'bg-emerald-500/10' : 'bg-zinc-800'}`}>
            <Radio className={`w-4 h-4 ${connected ? 'text-emerald-400' : 'text-zinc-500'}`} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Live Updates</h3>
            <p className={`text-[10px] ${connected ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
        </div>
        {connected && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        )}
      </div>

      {!update ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
            <Radio className="relative w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-400">Waiting for next push...</p>
          <p className="text-xs text-zinc-600 mt-1">Metrics will appear in real time</p>
        </div>
      ) : (
        <div>
          <div className="mb-4 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
              <GitCommit className="w-3 h-3" />
              {update.commitSha.slice(0, 7)}
            </div>
            <p className="text-4xl font-bold text-blue-400 tracking-tight">{update.healthScore.toFixed(1)}</p>
            <p className="text-xs text-zinc-500">health score</p>
          </div>
          <div className="space-y-2.5">
            {metrics.map((m) => (
              <div key={m.label} className="flex justify-between text-sm">
                <span className="text-zinc-500">{m.label}</span>
                <span className="text-white font-medium tabular-nums">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

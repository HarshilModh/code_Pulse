'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getFileNeighbors, explainFile } from '@/lib/api'
import type { FileNeighbor } from '@/lib/schema'
import { ArrowLeft, FileCode2, Radar, Ghost, Zap, Loader2, Sparkles } from 'lucide-react'

function MetricPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className={`font-tech text-[11px] px-2.5 py-1 rounded-full border ${tone}`}>
      {label}: {value}
    </span>
  )
}

export default function FileDetailPage() {
  const { id, path: pathSegments } = useParams()

  // [...path] gives us an array of segments — join to reconstruct the file path
  const filePath = Array.isArray(pathSegments)
    ? pathSegments.join('/')
    : (pathSegments as string)

  const { getToken, isLoaded, isSignedIn } = useAuth()

  const [explanation, setExplanation]   = useState('')
  const [streaming, setStreaming]       = useState(false)
  const [fileMetrics, setFileMetrics]   = useState<{ complexity?: number; isDead?: boolean; driftScore?: number | null } | null>(null)

  const { data: neighbors = [], isLoading: loadingNeighbors } = useQuery({
    queryKey: ['neighbors', id, filePath],
    queryFn: async () => {
      const token = await getToken()
      return getFileNeighbors(id as string, filePath, token!)
    },
    enabled: isLoaded && !!isSignedIn && !!id && !!filePath,
  })

  async function fetchExplanation() {
    setStreaming(true)
    setExplanation('')
    setFileMetrics(null)

    try {
      const token = await getToken()
      const res = await explainFile(id as string, filePath, token!)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          try {
            const event = JSON.parse(part.slice(6))
            if (event.type === 'fileAnalysis') {
              setFileMetrics(event.data)
            } else if (event.type === 'token') {
              setExplanation(t => t + event.content)
            }
          } catch {}
        }
      }
    } catch {
      setExplanation('Failed to load explanation.')
    } finally {
      setStreaming(false)
    }
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

      {/* File header */}
      <div className="flex items-start gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-[var(--surface-2)] border border-[var(--rule)] flex items-center justify-center shrink-0">
          <FileCode2 className="w-4 h-4 text-[var(--ink-muted)]" />
        </div>
        <div>
          <h1 className="text-[14px] font-medium text-[var(--ink)] font-mono break-all">{filePath}</h1>

          {fileMetrics && (
            <div className="flex flex-wrap gap-2 mt-2">
              {fileMetrics.complexity !== undefined && (
                <MetricPill
                  label="Complexity"
                  value={fileMetrics.complexity.toFixed(2)}
                  tone="bg-[var(--signal-complexity-bg)] text-[var(--signal-complexity)] border-[var(--signal-complexity)]/20"
                />
              )}
              {fileMetrics.isDead && (
                <MetricPill
                  label="Dead code"
                  value="yes"
                  tone="bg-[var(--surface-2)] text-[var(--ink-muted)] border-[var(--rule)]"
                />
              )}
              {fileMetrics.driftScore !== null && fileMetrics.driftScore !== undefined && (
                <MetricPill
                  label="Drift"
                  value={fileMetrics.driftScore.toFixed(2)}
                  tone="bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand)]/20"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI explanation section */}
      <div className="card overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rule)]">
          <span className="font-display text-[15px] font-medium text-[var(--ink)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--brand)]" />
            AI explanation
          </span>
          {!streaming && (
            <button
              onClick={fetchExplanation}
              className="font-tech text-[11px] px-3 py-1.5 text-white rounded-full transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
            >
              {explanation ? 'Re-explain' : 'Explain this file'}
            </button>
          )}
          {streaming && (
            <Loader2 className="w-4 h-4 text-[var(--ink-muted)] animate-spin" />
          )}
        </div>

        <div className="p-5 min-h-[120px]">
          {!explanation && !streaming && (
            <p className="text-[13px] text-[var(--ink-subtle)]">
              Click &ldquo;Explain this file&rdquo; — the AI will read the file and explain it with code tool access.
            </p>
          )}
          {(explanation || streaming) && (
            <p className="text-[14px] text-[var(--ink-soft)] whitespace-pre-wrap leading-relaxed">
              {explanation}
              {streaming && <span className="animate-pulse">▋</span>}
            </p>
          )}
        </div>
      </div>

      {/* Similar files section */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--rule)]">
          <span className="font-display text-[15px] font-medium text-[var(--ink)]">Similar files</span>
          <p className="font-tech text-[11px] text-[var(--ink-muted)] mt-0.5">Ranked by embedding cosine similarity</p>
        </div>

        {loadingNeighbors ? (
          <div className="flex justify-center py-8">
            <div className="w-4 h-4 border border-[var(--rule-strong)] border-t-[var(--ink)] rounded-full animate-spin" />
          </div>
        ) : neighbors.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-muted)] p-5">
            No embeddings yet — push a commit to generate them.
          </p>
        ) : (
          <div className="divide-y divide-[var(--rule)]">
            {neighbors.map((n: FileNeighbor) => (
              <Link
                key={n.filePath}
                href={`/repos/${id}/files/${n.filePath}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors group"
              >
                <span className="font-mono text-[12px] text-[var(--ink-muted)] group-hover:text-[var(--ink)] transition-colors truncate">
                  {n.filePath}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-16 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round(parseFloat(n.similarity) * 100)}%`, background: 'var(--brand)' }}
                    />
                  </div>
                  <span className="font-tech text-[11px] text-[var(--ink-muted)] w-10 text-right">{n.similarity}</span>

                  {n.isDead && <Ghost className="w-3.5 h-3.5 text-[var(--ink-subtle)]" title="Dead code" />}
                  {n.driftScore !== null && n.driftScore !== undefined && Number(n.driftScore) < 0.72 && (
                    <Radar className="w-3.5 h-3.5 text-[var(--brand)]" title="Drifting" />
                  )}
                  {n.complexity > 10 && (
                    <Zap className="w-3.5 h-3.5 text-[var(--signal-complexity)]" title="High complexity" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, Swords, Loader2 } from 'lucide-react'

const SUGGESTED_TOPICS = [
  'Refactor the queue service into microservices',
  'Migrate from REST to GraphQL',
  'Add a Redis caching layer',
  'Rewrite workers in TypeScript',
  'Extract shared utils into a separate package',
]

type Turn = {
  round: number
  text: string
  tools: { name: string; done: boolean }[]
}

export default function DebatePage() {
  const params = useParams()
  const id = params.id as string
  const { getToken } = useAuth()

  const [topic, setTopic] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRound, setCurrentRound] = useState(0)
  const [proTurns, setProTurns] = useState<Turn[]>([])
  const [conTurns, setConTurns] = useState<Turn[]>([])

  const currentRoundRef = useRef(0)
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

  async function startDebate() {
    if (!topic.trim() || streaming) return
    setStarted(true)
    setStreaming(true)
    setError(null)
    setProTurns([])
    setConTurns([])
    setCurrentRound(0)
    currentRoundRef.current = 0

    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/repos/${id}/agents/debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Server error ${res.status}: ${errText.slice(0, 200)}`)
      }

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
          let event: Record<string, unknown>
          try { event = JSON.parse(part.slice(6)) } catch { continue }

          if (event.type === 'round') {
            const round = event.round as number
            currentRoundRef.current = round
            setCurrentRound(round)
          } else if (event.type === 'persona_start') {
            const round = currentRoundRef.current
            if (event.persona === 'pro') {
              setProTurns(prev => [...prev, { round, text: '', tools: [] }])
            } else {
              setConTurns(prev => [...prev, { round, text: '', tools: [] }])
            }
          } else if (event.type === 'token') {
            const setter = event.persona === 'pro' ? setProTurns : setConTurns
            setter(prev => {
              if (prev.length === 0) return prev
              const next = [...prev]
              const last = { ...next[next.length - 1] }
              last.text += event.content as string
              next[next.length - 1] = last
              return next
            })
          } else if (event.type === 'tool_call') {
            const setter = event.persona === 'pro' ? setProTurns : setConTurns
            setter(prev => {
              if (prev.length === 0) return prev
              const next = [...prev]
              const last = { ...next[next.length - 1], tools: [...next[next.length - 1].tools] }
              last.tools.push({ name: event.name as string, done: false })
              next[next.length - 1] = last
              return next
            })
          } else if (event.type === 'tool_result') {
            const setter = event.persona === 'pro' ? setProTurns : setConTurns
            setter(prev => {
              if (prev.length === 0) return prev
              const next = [...prev]
              const last = { ...next[next.length - 1], tools: [...next[next.length - 1].tools] }
              const idx = last.tools.findLastIndex(t => t.name === event.name && !t.done)
              if (idx !== -1) last.tools[idx] = { ...last.tools[idx], done: true }
              next[next.length - 1] = last
              return next
            })
          } else if (event.type === 'error') {
            throw new Error(event.message as string)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-10 py-12 w-full">
      {/* Nav */}
      <div className="flex items-center justify-between mb-10">
        <Link
          href={`/repos/${id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-[var(--brand)]" />
          <span className="font-display text-[15px] text-[var(--ink)]">Debate Mode</span>
        </div>
      </div>

      {!started ? (
        /* ── Setup screen ── */
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">
              — Pro &amp; Con
            </div>
            <h1 className="font-display text-4xl text-[var(--ink)] tracking-tight mb-3">
              Refactor. Decline. You decide.
            </h1>
            <p className="text-sm text-[var(--ink-muted)]">
              Two AI personas debate a refactor for three rounds, citing real findings as evidence.
            </p>
          </div>

          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder={'What should we debate? e.g. "Refactor the queue service into microservices"'}
            rows={3}
            className="w-full bg-[var(--canvas)] border border-[var(--rule)] rounded-xl px-4 py-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 resize-none mb-3 transition-all"
          />

          <div className="flex flex-wrap gap-2 mb-6">
            {SUGGESTED_TOPICS.map(t => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="font-tech text-[11px] px-3 py-1.5 rounded-lg border border-[var(--rule)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--brand)]/50 transition-all"
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={startDebate}
            disabled={!topic.trim()}
            className="w-full py-3 rounded-xl font-display text-[15px] text-white transition-all hover:brightness-110 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
          >
            Start Debate
          </button>
        </div>
      ) : (
        /* ── Debate view ── */
        <div>
          {/* Topic banner */}
          <div className="text-center mb-8">
            <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-2">
              Debating
            </div>
            <p className="font-display text-xl text-[var(--ink)]">&ldquo;{topic}&rdquo;</p>
            {streaming && (
              <div className="flex items-center justify-center gap-2 mt-3 font-tech text-[11px] text-[var(--ink-muted)]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Round {currentRound} of 3
              </div>
            )}
            {error && (
              <p className="mt-3 text-sm" style={{ color: 'var(--negative)' }}>
                Error: {error}
              </p>
            )}
          </div>

          {/* Side-by-side columns */}
          <div className="grid grid-cols-2 gap-6">
            <DebateColumn label="Pro" turns={proTurns} streaming={streaming} />
            <DebateColumn label="Con" turns={conTurns} streaming={streaming} />
          </div>

          {!streaming && (
            <div className="text-center mt-8">
              <button
                onClick={() => { setStarted(false); setTopic('') }}
                className="font-tech text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--rule)] px-4 py-2 rounded-lg transition-all"
              >
                New debate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DebateColumn({
  label,
  turns,
  streaming,
}: {
  label: string
  turns: Turn[]
  streaming: boolean
}) {
  const isPro = label === 'Pro'

  return (
    <div className="card p-5 flex flex-col gap-5 min-h-[200px]">
      {/* Column header */}
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: isPro ? 'var(--positive)' : 'var(--negative)' }}
        />
        <span className="font-display text-[15px] font-medium text-[var(--ink)]">{label}</span>
      </div>

      {turns.length === 0 && streaming && (
        <div className="flex items-center gap-2 font-tech text-[11px] text-[var(--ink-muted)]">
          <Loader2 className="w-3 h-3 animate-spin" /> Preparing argument…
        </div>
      )}

      {turns.map((turn, i) => (
        <div key={i} className="space-y-2">
          {/* Round label */}
          <div className="font-tech text-[10px] uppercase tracking-[0.15em] text-[var(--ink-subtle)]">
            Round {turn.round}
          </div>

          {/* Tool calls */}
          {turn.tools.map((tool, j) => (
            <div key={j} className="flex items-center gap-1.5 font-tech text-[11px] text-[var(--ink-muted)]">
              {tool.done
                ? <span style={{ color: 'var(--positive)' }}>✓</span>
                : <Loader2 className="w-3 h-3 animate-spin" />
              }
              {tool.name.replace(/_/g, ' ')}
            </div>
          ))}

          {/* Argument text */}
          <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed whitespace-pre-wrap">
            {turn.text}
            {i === turns.length - 1 && streaming && turn.text === '' && (
              <span
                className="inline-block w-1.5 h-4 align-middle ml-0.5 animate-pulse"
                style={{ background: 'var(--ink-muted)' }}
              />
            )}
          </p>

          {/* Divider between rounds */}
          {i < turns.length - 1 && (
            <div className="border-t border-[var(--rule)] mt-3" />
          )}
        </div>
      ))}
    </div>
  )
}

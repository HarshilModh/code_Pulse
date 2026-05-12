'use client'
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { getRootCause } from '@/lib/api'
import { HelpCircle, X, Loader2 } from 'lucide-react'

export default function RootCauseAgent({ repoId, metric, direction }: {
  repoId: string
  metric: string
  direction: 'drop' | 'spike'
}) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [streaming, setStreaming] = useState(false)
  const { getToken } = useAuth()

  async function investigate() {
    setOpen(true)
    setContent('')
    setStreaming(true)
    try {
      const token = await getToken()
      const res = await getRootCause(repoId, metric, direction, token!)
      if (!res.ok) {
        const errText = await res.text()
        setContent(`Error ${res.status}: ${errText.slice(0, 300)}`)
        return
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
          try {
            const event = JSON.parse(part.slice(6))
            if (event.type === 'token') setContent(t => t + event.content)
            else if (event.type === 'error') setContent(`Error: ${event.message}`)
          } catch { }
        }
      }
    } catch (err) {
      setContent(`Error: ${err instanceof Error ? err.message : 'Something went wrong.'}`)
    } finally {
      setStreaming(false)
    }
  }

  return (
    <>
      <button
        onClick={investigate}
        className="inline-flex items-center gap-1 font-tech text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors mt-1"
      >
        <HelpCircle className="w-3 h-3" />
        Why?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
          <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--rule)] rounded-2xl shadow-2xl flex flex-col max-h-[65vh] pointer-events-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rule)] shrink-0">
              <span className="font-display text-[15px] font-medium text-[var(--ink)] capitalize">
                {metric} {direction} — Root Cause
              </span>
              <button onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-[14px] text-[var(--ink-soft)] whitespace-pre-wrap leading-relaxed">
              {streaming && !content && <Loader2 className="w-4 h-4 animate-spin text-[var(--ink-muted)]" />}
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'
import React from 'react'
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { getTour } from '@/lib/api'
import { Map, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

type Step = {
  title: string
  description: string
  files: string[]
  insight: string
}

const CodebaseTour = ({ repoId }: { repoId: string }) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [current, setCurrent] = useState(0)
  const { getToken } = useAuth()

  async function startTour() {
    setLoading(true)
    setOpen(true)
    setCurrent(0)
    try {
      const token = await getToken()
      const data = await getTour(repoId, token!)
      setSteps(data.steps ?? [])
    } catch {
      setSteps([])
    }
    setLoading(false)
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={startTour}
        className="inline-flex items-center gap-1.5 font-tech text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--rule)] hover:border-[var(--rule-strong)] rounded-lg px-3 py-1.5 transition-all"
      >
        <Map className="w-3.5 h-3.5" /> Tour
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--rule)] rounded-2xl shadow-2xl flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--rule)]">
              <span className="font-display text-[18px] font-medium text-[var(--ink)]">Codebase Tour</span>
              <button onClick={() => setOpen(false)}>
                <X className="w-4 h-4 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 min-h-[280px] flex flex-col">
              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--brand)]" />
                  <p className="font-tech text-[12px] text-[var(--ink-muted)]">Generating tour…</p>
                </div>
              )}

              {!loading && steps.length === 0 && (
                <p className="text-[13px] text-[var(--ink-muted)] text-center mt-8">Failed to generate tour. Try again.</p>
              )}

              {!loading && steps.length > 0 && (
                <>
                  {/* Step indicator */}
                  <div className="flex items-center gap-1.5 mb-4">
                    {steps.map((_, i) => (
                      <div
                        key={i}
                        className="h-1 rounded-full transition-all"
                        style={{
                          width: i === current ? '1.5rem' : '0.5rem',
                          background: i === current ? 'var(--brand)' : 'var(--surface-2)',
                        }}
                      />
                    ))}
                    <span className="font-tech text-[11px] text-[var(--ink-subtle)] ml-auto">
                      {current + 1} / {steps.length}
                    </span>
                  </div>

                  {/* Step content */}
                  <h3 className="font-display text-xl font-medium text-[var(--ink)] tracking-tight mb-2">
                    {steps[current].title}
                  </h3>
                  <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-4">
                    {steps[current].description}
                  </p>

                  {/* Files */}
                  {steps[current].files.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {steps[current].files.map(f => (
                        <span key={f} className="font-mono text-[11px] bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--rule)] rounded-md px-2 py-0.5">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Insight */}
                  <div className="mt-auto bg-[var(--brand)]/5 border border-[var(--brand)]/20 rounded-xl p-3">
                    <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed">{steps[current].insight}</p>
                  </div>
                </>
              )}
            </div>

            {/* Footer nav */}
            {!loading && steps.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--rule)]">
                <button
                  onClick={() => setCurrent(c => Math.max(0, c - 1))}
                  disabled={current === 0}
                  className="inline-flex items-center gap-1.5 font-tech text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button
                  onClick={() => {
                    if (current === steps.length - 1) setOpen(false)
                    else setCurrent(c => c + 1)
                  }}
                  className="inline-flex items-center gap-1.5 font-tech text-[12px] text-white rounded-full px-4 py-1.5 transition-all hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
                >
                  {current === steps.length - 1 ? 'Done' : 'Next'}
                  {current < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}

export default CodebaseTour

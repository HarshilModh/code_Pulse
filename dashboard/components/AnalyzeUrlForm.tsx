'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { analyzeRepo } from '../lib/api'
import { ArrowRight } from 'lucide-react'

export function AnalyzeUrlForm() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const { getToken } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    try {
      const token = await getToken()
      const { repoId } = await analyzeRepo(url.trim(), token!)
      router.push(`/repos/${repoId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 glass-strong gradient-ring rounded-[14px] p-1.5 transition-all w-full relative"
    >
      <div className="flex-1 min-w-0 flex items-center h-8 pl-3 bg-transparent">
        <span className="font-tech text-[12px] text-zinc-400 shrink-0 select-none">
          github.com/
        </span>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="owner/repo"
          disabled={loading}
          className="flex-1 bg-transparent font-tech text-[13px] text-zinc-800 placeholder:text-zinc-300 outline-none px-0.5 w-full min-w-0"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium text-white rounded-xl px-4 h-8 transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap bg-indigo-600 shadow-[0_1px_3px_rgba(79,70,229,0.3)]"
      >
        {loading ? '…' : 'Analyze'}
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </form>
  )
}

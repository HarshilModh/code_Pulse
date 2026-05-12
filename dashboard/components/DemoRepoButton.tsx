'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { forkDemo } from '../lib/api'
import { Sparkles } from 'lucide-react'

export function DemoRepoButton() {
  const [loading, setLoading] = useState(false)
  const { getToken } = useAuth()
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    try {
      const token = await getToken()
      const { repoId } = await forkDemo(token!)
      router.push(`/repos/${repoId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white rounded-full px-4 py-2 transition-all hover:brightness-110 disabled:opacity-40"
      style={{
        background: 'linear-gradient(135deg, var(--signal-coverage) 0%, var(--brand-3) 100%)',
        boxShadow: '0 1px 3px rgba(5,150,105,0.25)',
      }}
    >
      <Sparkles className="w-3.5 h-3.5" />
      {loading ? 'Loading…' : 'Try the demo'}
    </button>
  )
}

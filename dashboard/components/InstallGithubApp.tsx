'use client'

import { useUser } from '@clerk/nextjs'
import { ArrowUpRight } from 'lucide-react'

export function InstallGithubApp() {
  const { user } = useUser()
  if (!user) return null

  const installUrl = `https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/new?state=${user.id}`

  return (
    <a
      href={installUrl}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink)] border border-[var(--rule)] rounded-full px-4 py-2 hover:border-[var(--rule-strong)] hover:bg-[var(--surface-2)] transition-all"
    >
      Install GitHub App
      <ArrowUpRight className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
    </a>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { getRepos } from '@/lib/api'
import type { Repo } from '@/lib/schema'
import Link from 'next/link'
import { GitBranch, ArrowUpRight, Plus, AlertCircle } from 'lucide-react'

export default function Home() {
  const { data: repos, isLoading, isError } = useQuery({
    queryKey: ['repos'],
    queryFn: getRepos,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="max-w-md mx-auto text-center py-32">
        <div className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 mb-4">
          <AlertCircle className="w-5 h-5 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">Can't reach the API</h2>
        <p className="text-sm text-zinc-400">Make sure your backend is running on port 3000.</p>
      </div>
    )
  }

  if (!repos || repos.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-32">
        <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/20 mb-5">
          <GitBranch className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No repositories yet</h2>
        <p className="text-sm text-zinc-400 mb-6">
          Install the CodePulse GitHub App on a repo to start monitoring its health on every push.
        </p>
        <a
          href="https://github.com/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-white text-zinc-950 hover:bg-zinc-200 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Install GitHub App
        </a>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">Repositories</h1>
          <p className="text-zinc-400 mt-1.5 text-sm">
            {repos.length} {repos.length === 1 ? 'repo' : 'repos'} monitored — select one to view its health dashboard.
          </p>
        </div>
        <a
          href="https://github.com/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add repo
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {repos.map((repo: Repo) => (
          <Link
            key={repo.id}
            href={`/repos/${repo.id}`}
            className="group relative overflow-hidden bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-start justify-between mb-6">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 mb-1 truncate">{repo.owner}</p>
                  <h2 className="text-white font-medium truncate">{repo.name}</h2>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <GitBranch className="w-3 h-3" />
                  <span>Monitored</span>
                </div>
                <span className="text-zinc-600">
                  {new Date(repo.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

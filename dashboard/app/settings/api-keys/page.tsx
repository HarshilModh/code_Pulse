'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { getApiKeys, createApiKey, deleteApiKey } from '@/lib/api'
import type { ApiKey } from '@/lib/schema'
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react'

export default function ApiKeysPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const token = await getToken()
      return getApiKeys(token!)
    },
    enabled: isLoaded && !!isSignedIn,
  })

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      return createApiKey(name.trim(), token!)
    },
    onSuccess: (data) => {
      setRevealedKey(data.key)
      setName('')
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const { mutate: revoke } = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      return deleteApiKey(id, token!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  async function copyKey() {
    if (!revealedKey) return
    await navigator.clipboard.writeText(revealedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-10 py-12 w-full flex-1">

      {/* Page header */}
      <div className="mb-10">
        <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">
          — Settings
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-light)] flex items-center justify-center shrink-0">
            <Key className="w-4 h-4 text-[var(--brand)]" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-medium text-[var(--ink)] tracking-tight">API keys</h1>
            <p className="font-tech text-[11px] text-[var(--ink-muted)] mt-0.5">
              Authenticate MCP server calls — treat as passwords
            </p>
          </div>
        </div>
      </div>

      {/* One-time reveal banner */}
      {revealedKey && (
        <div className="mb-6 rounded-2xl p-4 border" style={{ background: 'var(--signal-coverage-bg)', borderColor: 'rgba(5,150,105,0.2)' }}>
          <p className="font-tech text-[11px] uppercase tracking-wide text-[var(--signal-coverage)] mb-2">
            Copy this key now — it will never be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-tech text-[12px] text-[var(--ink)] bg-[var(--surface)] rounded-xl px-3 py-2 truncate border border-[var(--rule)]">
              {revealedKey}
            </code>
            <button
              onClick={copyKey}
              className="shrink-0 w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--rule)] hover:border-[var(--rule-strong)] flex items-center justify-center transition-all"
              title="Copy to clipboard"
            >
              {copied
                ? <Check className="w-3.5 h-3.5 text-[var(--signal-coverage)]" />
                : <Copy className="w-3.5 h-3.5 text-[var(--ink-muted)]" />}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 font-tech text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
          >
            I&apos;ve copied it — dismiss
          </button>
        </div>
      )}

      {/* Create key form */}
      <div className="card p-5 mb-6">
        <h2 className="font-display text-lg font-medium text-[var(--ink)] tracking-tight mb-4">Create new key</h2>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) create() }}
            placeholder="Key name (e.g. my-local-mcp)"
            className="flex-1 bg-[var(--canvas)] border border-[var(--rule)] text-[var(--ink)] rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 placeholder:text-[var(--ink-subtle)] transition-all"
          />
          <button
            onClick={() => create()}
            disabled={creating || !name.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white rounded-xl transition-all hover:brightness-110 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
          >
            <Plus className="w-3.5 h-3.5" />
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      {/* Key list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border border-[var(--rule-strong)] border-t-[var(--ink)] rounded-full animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12">
          <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-subtle)] mb-2">— Empty</div>
          <p className="text-[13px] text-[var(--ink-muted)]">No API keys yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k: ApiKey) => (
            <div
              key={k.id}
              className="card flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[var(--ink)] truncate">{k.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <code className="font-tech text-[11px] text-[var(--ink-muted)]">{k.prefix}••••••••••••</code>
                  {k.lastUsedAt && (
                    <span className="font-tech text-[11px] text-[var(--ink-subtle)]">
                      Last used {new Date(k.lastUsedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => revoke(k.id)}
                title="Revoke key"
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--ink-subtle)] hover:text-[var(--signal-vuln)] hover:bg-[var(--signal-vuln-bg)] transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { ShieldAlert, Zap, Radar, Ghost, Bot, MessageSquare, Loader2 } from 'lucide-react'

type FindingComment = {
    id: string
    userId: string
    body: string
    createdAt: string
}

type Finding = {
    id: string
    repoId: string
    type: string        // drift | complexity | vuln | dead_code | ai_review
    severity: string    // critical | high | medium | low
    filePath: string | null
    line: number | null
    title: string
    body: string
    status: string      // open | acknowledged | resolved | dismissed | snoozed | wont_fix
    createdAt: string
    comments: FindingComment[]
    repo?: { owner: string; name: string }  // present on global findings page
}

type Props = {
    finding: Finding
    showRepo?: boolean
    onStatusChange?: (id: string, status: string) => void
}

function severityColor(severity: string) {
    switch (severity) {
        case 'critical': return { dot: 'bg-red-500',    badge: 'bg-red-500/10 text-red-400 border-red-500/20' }
        case 'high':     return { dot: 'bg-orange-500', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' }
        case 'medium':   return { dot: 'bg-amber-500',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
        default:         return { dot: 'bg-[var(--ink-muted)]', badge: 'bg-[var(--surface-2)] text-[var(--ink-muted)] border-[var(--rule)]' }
    }
}

function typeIcon(type: string) {
    switch (type) {
        case 'vuln':       return <ShieldAlert className="w-3.5 h-3.5" />
        case 'complexity': return <Zap className="w-3.5 h-3.5" />
        case 'drift':      return <Radar className="w-3.5 h-3.5" />
        case 'dead_code':  return <Ghost className="w-3.5 h-3.5" />
        default:           return <Bot className="w-3.5 h-3.5" />
    }
}

const FindingCard = (({ finding, showRepo, onStatusChange }: Props) => {
    const { getToken } = useAuth()
    const [expanded, setExpanded] = useState(false)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [localComments, setLocalComments] = useState(finding.comments)
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

    async function changeStatus(status: string) {
        const token = await getToken()
        await fetch(`${API_URL}/findings/${finding.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status }),
        })
        onStatusChange?.(finding.id, status)
    }

    async function addComment() {
        if (comment.trim() === '') return
        setSubmitting(true)
        try {
            const token = await getToken()
            const res = await fetch(`${API_URL}/findings/${finding.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ body: comment }),
            })
            const newComment = await res.json()
            setLocalComments([...localComments, newComment])
            setComment('')
        } catch (error) {
            console.error('Error adding comment:', error)
        } finally {
            setSubmitting(false)
        }
    }

    const color = severityColor(finding.severity)

    return (
        <div className="card overflow-hidden">

            {/* Header row */}
            <div className="flex items-start gap-3 p-4">
                {/* Severity dot */}
                <div className={`w-2 h-2 rounded-full ${color.dot} mt-1.5 shrink-0`} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                            {showRepo && finding.repo && (
                                <p className="font-tech text-[11px] text-[var(--ink-muted)] mb-0.5">
                                    {finding.repo.owner}/{finding.repo.name}
                                </p>
                            )}
                            <p className="text-[14px] font-medium text-[var(--ink)]">{finding.title}</p>
                            {finding.filePath && (
                                <p className="font-mono text-[11px] text-[var(--ink-muted)] mt-0.5 truncate">{finding.filePath}</p>
                            )}
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-tech text-[11px] px-2 py-0.5 rounded-full border ${color.badge}`}>
                                {finding.severity}
                            </span>
                            <span className="font-tech text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] flex items-center gap-1 border border-[var(--rule)]">
                                {typeIcon(finding.type)}
                                {finding.type.replace('_', ' ')}
                            </span>
                        </div>
                    </div>

                    {/* Body */}
                    <p className="text-[13px] text-[var(--ink-soft)] mt-1.5 leading-relaxed">{finding.body}</p>

                    {/* Action row */}
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <select
                            value={finding.status}
                            onChange={e => changeStatus(e.target.value)}
                            className="font-tech text-[11px] bg-[var(--surface-2)] border border-[var(--rule)] text-[var(--ink-muted)] rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-[var(--brand)]/20 transition-all cursor-pointer"
                        >
                            <option value="open">Open</option>
                            <option value="acknowledged">Acknowledged</option>
                            <option value="resolved">Resolved</option>
                            <option value="dismissed">Dismissed</option>
                            <option value="wont_fix">Won&apos;t fix</option>
                        </select>

                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="font-tech text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors flex items-center gap-1"
                        >
                            <MessageSquare className="w-3 h-3" />
                            {localComments.length > 0 ? `${localComments.length} comment${localComments.length > 1 ? 's' : ''}` : 'Add comment'}
                        </button>

                        <span className="font-tech text-[11px] text-[var(--ink-subtle)]">
                            {new Date(finding.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Comments section */}
            {expanded && (
                <div className="border-t border-[var(--rule)] px-4 py-3 space-y-3">
                    {localComments.map(c => (
                        <div key={c.id} className="text-[13px] text-[var(--ink)] leading-relaxed">
                            <span className="font-tech text-[11px] text-[var(--ink-muted)] mr-2">
                                {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            {c.body}
                        </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                        <input
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addComment() }}
                            placeholder="Add a comment…"
                            className="flex-1 bg-[var(--canvas)] border border-[var(--rule)] rounded-lg px-3 py-1.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                        />
                        <button
                            onClick={addComment}
                            disabled={submitting || !comment.trim()}
                            className="font-tech text-[11px] px-3 py-1.5 text-white rounded-lg transition-all hover:brightness-110 disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
                        >
                            {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Post'}
                        </button>
                    </div>
                </div>
            )}

        </div>
    )
})

export default FindingCard

'use client'
import React from 'react'
import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, Plus, Send, Loader2 } from 'lucide-react'

type UiMsg =
    | { role: 'user'; content: string }
    | { role: 'assistant'; content: string }
    | { role: 'tool'; toolName: string; pending: boolean }

type Session = {
    id: string
    createdAt: string
    messages: { role: string; content: string }[]
}

const page = () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'
    const { id } = useParams()
    const { getToken, isSignedIn } = useAuth()
    const queryClient = useQueryClient()
    const [messages, setMessages] = useState<UiMsg[]>([])
    const [input, setInput] = useState('')
    const [streaming, setStreaming] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const streamingIdxRef = useRef<number>(-1)
    const bottomRef = useRef<HTMLDivElement>(null)

    const { data: sessions = [] } = useQuery({
        queryKey: ['chat-sessions', id],
        queryFn: async () => {
            const token = await getToken()
            const res = await fetch(`${API_URL}/repos/${id}/chat/sessions`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            return res.json()
        },
        enabled: !!isSignedIn && !!id,
    })

    const { data: loadedSession } = useQuery({
        queryKey: ['chat-session-messages', activeSessionId],
        queryFn: async () => {
            const token = await getToken()
            const res = await fetch(`${API_URL}/repos/${id}/chat/sessions/${activeSessionId}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            return res.json() as Promise<{ messages: { role: string; content: string }[] }>
        },
        enabled: !!activeSessionId,
    })

    useEffect(() => {
        if (!loadedSession) return
        setMessages(
            loadedSession.messages
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        )
    }, [loadedSession])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    async function sendMessage() {
        const text = input.trim()
        if (!text || streaming) return
        setInput('')
        setStreaming(true)
        streamingIdxRef.current = -1

        const apiMessages = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: (m as { role: string; content: string }).content }))
        apiMessages.push({ role: 'user', content: text })
        setMessages(prev => [...prev, { role: 'user', content: text }])

        try {
            const token = await getToken()
            const res = await fetch(`${API_URL}/repos/${id}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ messages: apiMessages, sessionId }),
            })

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

                        if (event.type === 'token') {
                            setMessages(prev => {
                                const next = [...prev]
                                const lastMsg = next[next.length - 1] as UiMsg | undefined
                                
                                if (!lastMsg || lastMsg.role !== 'assistant') {
                                    next.push({ role: 'assistant', content: event.content as string })
                                } else {
                                    next[next.length - 1] = { ...lastMsg, content: lastMsg.content + (event.content as string) }
                                }
                                return next
                            })
                        } else if (event.type === 'tool_call') {
                            setMessages(prev => [...prev, { role: 'tool', toolName: event.name, pending: true }])
                        } else if (event.type === 'tool_result') {
                            setMessages(prev => {
                                const next = [...prev]
                                const idx = next.findLastIndex(
                                    m => m.role === 'tool' && (m as { toolName: string; pending: boolean }).toolName === event.name && (m as { pending: boolean }).pending
                                )
                                if (idx !== -1) {
                                    const toolMsg = next[idx] as { role: 'tool'; toolName: string; pending: boolean }
                                    next[idx] = { role: 'tool', toolName: toolMsg.toolName, pending: false }
                                }
                                return next
                            })
                        } else if (event.type === 'session') {
                            setSessionId(event.sessionId)
                            queryClient.invalidateQueries({ queryKey: ['chat-sessions', id] })
                        }
                    } catch { }
                }
            }
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
        } finally {
            setStreaming(false)
        }
    }

    if (!isSignedIn) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
                <p className="font-tech text-[12px] text-[var(--ink-muted)]">Please sign in to access the chat.</p>
            </div>
        )
    }

    const newChat = () => {
        setMessages([])
        setActiveSessionId(null)
        setSessionId(null)
    }

    return (
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 w-full flex-1 flex flex-col">
            {/* Back link */}
            <Link
                href={`/repos/${id}`}
                className="inline-flex items-center gap-1.5 font-tech text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors mb-6"
            >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
            </Link>

            {/* Page title */}
            <div className="mb-6">
                <div className="font-tech text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-2">— AI chat</div>
                <h1 className="font-display text-3xl text-[var(--ink)] tracking-tighter font-medium leading-[1]">
                    Ask your codebase
                </h1>
            </div>

            <div className="flex h-[calc(100vh-16rem)] border border-[var(--rule)] rounded-2xl overflow-hidden bg-[var(--surface)]">

                {/* Sidebar */}
                <div className="w-56 shrink-0 border-r border-[var(--rule)] flex flex-col bg-[var(--canvas)]">
                    <div className="p-3 border-b border-[var(--rule)]">
                        <button
                            onClick={newChat}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white font-medium transition-all hover:brightness-110"
                            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
                        >
                            <Plus className="w-4 h-4" /> New Chat
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {sessions.map((s: any) => (
                            <button
                                key={s.id}
                                onClick={() => { setActiveSessionId(s.id); setSessionId(s.id) }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${activeSessionId === s.id
                                    ? 'bg-[var(--brand)]/10 border border-[var(--brand)]/20'
                                    : 'hover:bg-[var(--surface-2)] border border-transparent'
                                    }`}
                            >
                                <p className="text-[12px] text-[var(--ink)] truncate">
                                    {s.messages[0]?.content || 'New conversation'}
                                </p>
                                <p className="font-tech text-[10px] text-[var(--ink-subtle)] mt-0.5">
                                    {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </p>
                            </button>
                        ))}
                        {sessions.length === 0 && (
                            <p className="font-tech text-[11px] text-[var(--ink-subtle)] text-center py-4">No conversations yet</p>
                        )}
                    </div>
                </div>

                {/* Chat area */}
                <div className="flex-1 flex flex-col min-w-0">

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center pt-16">
                                <MessageSquare className="w-8 h-8 text-[var(--ink-subtle)] mx-auto mb-3" />
                                <p className="text-[13px] text-[var(--ink-muted)]">Ask anything about this repository</p>
                            </div>
                        )}
                        {messages.map((msg, i) => {
                            if (msg.role === 'tool') {
                                return (
                                    <div key={i} className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                                        {msg.pending
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <span className="text-[var(--positive)]">✓</span>
                                        }
                                        <span className="font-tech">{msg.toolName.replace(/_/g, ' ')}</span>
                                    </div>
                                )
                            }
                            return (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${msg.role === 'user'
                                            ? 'text-white'
                                            : 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--rule)]'
                                            }`}
                                        style={msg.role === 'user' ? { background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' } : undefined}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-[var(--rule)]">
                        <div className="flex gap-2">
                            <input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                                placeholder="Ask about this repo…"
                                className="flex-1 bg-[var(--canvas)] border border-[var(--rule)] rounded-xl px-4 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={streaming || !input.trim()}
                                className="px-4 py-2.5 disabled:opacity-40 rounded-xl text-sm text-white flex items-center gap-2 transition-all hover:brightness-110"
                                style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
                            >
                                {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default page

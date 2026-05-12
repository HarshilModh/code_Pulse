"use client"

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

const ChatPannel = ({ repoId }: { repoId: string }) => {
    type UiMsg =
        | { role: 'user'; content: string }
        | { role: 'assistant'; content: string }
        | { role: 'tool'; toolName: string; pending: boolean }

    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<UiMsg[]>([])
    const [input, setInput] = useState('')
    const [streaming, setStreaming] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const streamingIdxRef = useRef<number>(-1)
    const bottomRef = useRef<HTMLDivElement>(null)
    const { getToken } = useAuth()

    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

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
            const res = await fetch(`${API_URL}/repos/${repoId}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ messages: apiMessages, sessionId }),
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

                    if (event.type === 'token') {
                        setMessages(prev => {
                            const next = [...prev]
                            const lastMsg = next[next.length - 1] as UiMsg | undefined
                            
                            // If the last message in the UI isn't an assistant message (e.g. it's a user msg or a tool call),
                            // we push a new assistant message. Otherwise, append the token to the existing one.
                            // This is a pure updater function, safe for React Strict Mode.
                            if (!lastMsg || lastMsg.role !== 'assistant') {
                                next.push({ role: 'assistant', content: event.content as string })
                            } else {
                                next[next.length - 1] = { ...lastMsg, content: lastMsg.content + (event.content as string) }
                            }
                            return next
                        })
                    } else if (event.type === 'tool_call') {
                        setMessages(prev => [...prev, { role: 'tool', toolName: event.name as string, pending: true }])
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
                        setSessionId(event.sessionId as string)
                    } else if (event.type === 'error') {
                        throw new Error(event.message as string)
                    }
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Something went wrong.'
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
        } finally {
            setStreaming(false)
        }
    }

    return (
        <>
            {/* Toggle button */}
            <button
                onClick={() => setOpen(o => !o)}
                className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))', boxShadow: '0 4px 20px rgba(5,150,105,0.35)' }}
            >
                {open ? <X className="w-5 h-5 text-white" /> : <MessageCircle className="w-5 h-5 text-white" />}
            </button>

            {/* Panel */}
            {open && (
                <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[520px] bg-[var(--surface)] border border-[var(--rule)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                    {/* Header */}
                    <div className="px-4 py-3 border-b border-[var(--rule)] flex items-center gap-2 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" />
                        <span className="font-display text-[15px] font-medium text-[var(--ink)]">CodePulse AI</span>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.length === 0 && (
                            <p className="font-tech text-[12px] text-[var(--ink-muted)] text-center mt-8">
                                Ask anything about this repo&apos;s health, code patterns, or drift.
                            </p>
                        )}
                        {messages.map((msg, i) => {
                            if (msg.role === 'tool') {
                                return (
                                    <div key={i} className="flex items-center gap-2 font-tech text-[11px] text-[var(--ink-muted)] pl-1">
                                        {msg.pending
                                            ? <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                            : <span className="text-[var(--positive)] shrink-0">✓</span>
                                        }
                                        <span>{msg.toolName.replace(/_/g, ' ')}</span>
                                    </div>
                                )
                            }
                            return (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${msg.role === 'user'
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
                    <div className="p-3 border-t border-[var(--rule)] flex gap-2 shrink-0">
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                            placeholder="Ask about this repo…"
                            className="flex-1 bg-[var(--canvas)] border border-[var(--rule)] rounded-lg px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={streaming || !input.trim()}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:brightness-110 disabled:opacity-40 shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-2))' }}
                        >
                            {streaming
                                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                                : <Send className="w-4 h-4 text-white" />
                            }
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}

export default ChatPannel

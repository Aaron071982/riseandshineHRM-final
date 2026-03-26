'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageCircle, Send, Loader2 } from 'lucide-react'
import Link from 'next/link'

type Conversation = {
  rbtProfileId: string
  name: string
  email: string | null
  unreadCount: number
  lastMessage: string | null
  lastMessageAt: string | null
}

type Message = {
  id: string
  senderRole: string
  message: string
  isRead: boolean
  createdAt: string
}

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ rbtProfileId: string; name: string; email: string | null } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchConversations() {
      try {
        const res = await fetch('/api/admin/messages', { credentials: 'include' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setConversations(data.conversations ?? [])
      } catch {
        if (!cancelled) setConversations([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchConversations()
    return () => { cancelled = true }
  }, [])

  const fetchMessages = useCallback(async (rbtProfileId: string) => {
    try {
      const res = await fetch(`/api/admin/messages/${rbtProfileId}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setProfile(data.profile ?? null)
      setMessages(data.messages ?? [])
    } catch {
      setProfile(null)
      setMessages([])
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId)
    } else {
      setProfile(null)
      setMessages([])
    }
  }, [selectedId, fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendReply = async () => {
    if (!selectedId || !input.trim() || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    try {
      const res = await fetch(`/api/admin/messages/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        credentials: 'include',
      })
      if (res.ok) {
        const created = await res.json()
        setMessages((prev) => [...prev, created])
      } else {
        const data = await res.json().catch(() => ({}))
        console.warn('[AdminMessagesPage] Send failed:', res.status, data.error ?? res.statusText)
        setInput(text)
      }
    } catch (e) {
      console.warn('[AdminMessagesPage] Send error:', e)
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
          Messages
        </h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">
          Chat with RBTs who have reached out for help.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#e36f1e]" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-[var(--text-tertiary)] text-sm">
                No conversations yet.
              </p>
            ) : (
              <ul className="divide-y dark:divide-[var(--border-subtle)]">
                {conversations.map((c) => (
                  <li key={c.rbtProfileId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.rbtProfileId)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)] flex items-center justify-between gap-2 ${
                        selectedId === c.rbtProfileId
                          ? 'bg-orange-50 dark:bg-[var(--orange-subtle)]'
                          : ''
                      }`}
                    >
                      <span className="font-medium truncate">{c.name}</span>
                      {c.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-red-500 text-white text-xs px-2 py-0.5">
                          {c.unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)] flex flex-col min-h-[400px]">
          {selectedId && profile ? (
            <>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">{profile.name}</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/rbts/${selectedId}`}>View profile</Link>
                </Button>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto min-h-[240px] max-h-[360px] border dark:border-[var(--border-subtle)] rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-[var(--bg-primary)]">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.senderRole === 'ADMIN' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          m.senderRole === 'ADMIN'
                            ? 'bg-[#e36f1e] text-white'
                            : 'bg-gray-200 dark:bg-[var(--bg-elevated)] text-gray-900 dark:text-[var(--text-primary)]'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.message}</p>
                        <p
                          className={`text-xs mt-1 ${
                            m.senderRole === 'ADMIN'
                              ? 'text-orange-100'
                              : 'text-gray-500 dark:text-[var(--text-tertiary)]'
                          }`}
                        >
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <form
                  className="flex gap-2 mt-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendReply()
                  }}
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button type="submit" size="icon" disabled={!input.trim() || sending}>
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center text-gray-500 dark:text-[var(--text-tertiary)]">
              Select a conversation
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}

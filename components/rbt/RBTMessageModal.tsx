'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send } from 'lucide-react'

type Message = {
  id: string
  senderRole: string
  message: string
  isRead: boolean
  createdAt: string
}

interface RBTMessageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function RBTMessageModal({ open, onOpenChange }: RBTMessageModalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [unreadFromAdmin, setUnreadFromAdmin] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/rbt/messages', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages ?? [])
      setUnreadFromAdmin(data.unreadFromAdmin ?? 0)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetchMessages().finally(() => setLoading(false))
      fetch('/api/rbt/messages/read', { method: 'POST', credentials: 'include' }).catch(() => {})
    }
  }, [open, fetchMessages])

  useEffect(() => {
    if (!open) return
    const interval = setInterval(fetchMessages, 30_000)
    return () => clearInterval(interval)
  }, [open, fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    try {
      const res = await fetch('/api/rbt/messages', {
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
        setInput(text)
        console.warn('[RBTMessageModal] Send failed:', res.status, data.error ?? res.statusText)
      }
    } catch {
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Need Help?</DialogTitle>
          <DialogDescription>
            Send a message to the admin team. We typically reply within 1 business day.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-[240px] max-h-[360px] overflow-y-auto border dark:border-[var(--border-subtle)] rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-[var(--bg-primary)]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-[#e36f1e]" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-6">
              No messages yet. Send a message to get started.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.senderRole === 'RBT' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.senderRole === 'RBT'
                      ? 'bg-[#e36f1e] text-white'
                      : 'bg-gray-200 dark:bg-[var(--bg-elevated)] text-gray-900 dark:text-[var(--text-primary)]'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  <p
                    className={`text-xs mt-1 ${
                      m.senderRole === 'RBT'
                        ? 'text-orange-100'
                        : 'text-gray-500 dark:text-[var(--text-tertiary)]'
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage()
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
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
      </DialogContent>
    </Dialog>
  )
}

export function useRBTUnreadMessages(): number {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    let cancelled = false
    async function fetchCount() {
      try {
        const res = await fetch('/api/rbt/messages', { credentials: 'include' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setUnread(data.unreadFromAdmin ?? 0)
      } catch {
        // ignore
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])
  return unread
}

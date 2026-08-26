'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  applyMentionPick,
  getActiveMentionQuery,
} from '@/lib/crm/tasks/mentions'
import { searchTaskMentionUsers } from '@/lib/crm/tasks/actions'

export type MentionUser = {
  id: string
  name: string | null
  email: string | null
}

/**
 * Shared @mention state for task chat composers.
 * Shows matches on bare `@` (not only after 1+ characters).
 */
export function useTaskMentions(seedUsers: MentionUser[]) {
  const [draft, setDraft] = useState('')
  const [activeQuery, setActiveQuery] = useState<string | null>(null)
  const [remoteUsers, setRemoteUsers] = useState<MentionUser[] | null>(null)

  const onDraftChange = (v: string) => {
    setDraft(v)
    setActiveQuery(getActiveMentionQuery(v))
  }

  useEffect(() => {
    if (activeQuery === null) {
      setRemoteUsers(null)
      return
    }
    const q = activeQuery.trim()
    // Prefer live search once the user has typed a letter; otherwise use seed list
    if (q.length < 1) {
      setRemoteUsers(null)
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      void searchTaskMentionUsers(q).then((res) => {
        if (cancelled || !res.ok) return
        setRemoteUsers(res.users)
      })
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [activeQuery])

  const mentionMatches = useMemo(() => {
    if (activeQuery === null) return []
    const q = activeQuery.trim().toLowerCase()
    const pool = remoteUsers && remoteUsers.length > 0 ? remoteUsers : seedUsers
    const filtered = !q
      ? pool
      : pool.filter(
          (u) =>
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
        )
    return filtered.slice(0, 8)
  }, [activeQuery, remoteUsers, seedUsers])

  const pickMention = (u: MentionUser) => {
    const label = u.name || u.email || 'User'
    setDraft((c) => applyMentionPick(c, label, u.id))
    setActiveQuery(null)
    setRemoteUsers(null)
  }

  const clearDraft = () => {
    setDraft('')
    setActiveQuery(null)
    setRemoteUsers(null)
  }

  return {
    draft,
    setDraft: onDraftChange,
    mentionMatches,
    pickMention,
    clearDraft,
  }
}

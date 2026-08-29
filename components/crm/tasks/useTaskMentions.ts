'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  applyMentionPick,
  getActiveMentionQuery,
  TASK_MENTION_DEPTS,
} from '@/lib/crm/tasks/mentions'
import { searchTaskMentionUsers } from '@/lib/crm/tasks/actions'
import { ownerDeptLabel } from '@/lib/crm/tasks/constants'
import type { ClientOwnerDept } from '@prisma/client'

export type MentionTarget = {
  kind: 'user' | 'dept'
  id: string
  name: string
  email?: string | null
  dept?: ClientOwnerDept
}

/**
 * Shared @mention state for task chat composers.
 * Supports multiple people and department pools in one message.
 */
export function useTaskMentions(
  seedUsers: Array<
    | MentionTarget
    | { id: string; name: string | null; email: string | null }
  >
) {
  const [draft, setDraft] = useState('')
  const [activeQuery, setActiveQuery] = useState<string | null>(null)
  const [remoteUsers, setRemoteUsers] = useState<MentionTarget[] | null>(null)

  const seedUserTargets = useMemo(
    (): MentionTarget[] =>
      seedUsers
        .map((u) =>
          'kind' in u
            ? u
            : {
                kind: 'user' as const,
                id: u.id,
                name: u.name || u.email || 'User',
                email: u.email,
              }
        )
        .filter((u): u is MentionTarget => u.kind === 'user'),
    [seedUsers]
  )

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
    if (q.length < 1) {
      setRemoteUsers(null)
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      void searchTaskMentionUsers(q).then((res) => {
        if (cancelled || !res.ok) return
        setRemoteUsers(
          res.users.map((u) => ({
            kind: 'user' as const,
            id: u.id,
            name: u.name || u.email || 'User',
            email: u.email,
          }))
        )
      })
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [activeQuery])

  const mentionMatches = useMemo((): MentionTarget[] => {
    if (activeQuery === null) return []
    const q = activeQuery.trim().toLowerCase()

    const deptMatches: MentionTarget[] = TASK_MENTION_DEPTS.filter((dept) => {
      if (!q) return true
      const label = ownerDeptLabel(dept).toLowerCase()
      return label.includes(q) || dept.toLowerCase().replace(/_/g, ' ').includes(q)
    }).map((dept) => ({
      kind: 'dept' as const,
      id: `dept:${dept}`,
      name: ownerDeptLabel(dept),
      dept,
    }))

    const userPool =
      remoteUsers && remoteUsers.length > 0 ? remoteUsers : seedUserTargets
    const userMatches = (!q
      ? userPool
      : userPool.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
        )
    ).slice(0, 6)

    return [...userMatches, ...deptMatches].slice(0, 10)
  }, [activeQuery, remoteUsers, seedUserTargets])

  const pickMention = (target: MentionTarget) => {
    setDraft((c) => applyMentionPick(c, target.name, target.id))
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

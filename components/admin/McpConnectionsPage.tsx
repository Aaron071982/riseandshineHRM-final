'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, ShieldOff } from 'lucide-react'

type ConnectionItem = {
  id: string
  clientId: string
  clientName: string
  scope: string
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
}

export default function McpConnectionsPage() {
  const [items, setItems] = useState<ConnectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/mcp-connections', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setItems(json.items ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const revoke = async (tokenId: string) => {
    setRevoking(tokenId)
    try {
      const res = await fetch('/api/admin/mcp-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tokenId }),
      })
      if (!res.ok) throw new Error('Failed')
      await fetchData()
    } finally {
      setRevoking(null)
    }
  }

  const revokeAll = async () => {
    if (!confirm('Revoke ALL active MCP OAuth tokens? Claude will need to re-authorize.')) return
    setRevokingAll(true)
    try {
      const res = await fetch('/api/admin/mcp-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'revoke_all' }),
      })
      if (!res.ok) throw new Error('Failed')
      await fetchData()
    } finally {
      setRevokingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            MCP Connections
          </h1>
          <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)] mt-1">
            Active OAuth tokens issued to Claude and other MCP clients. Revoke access instantly if needed.
          </p>
          <p className="text-sm mt-2">
            <Link href="/admin/mcp-activity" className="text-orange-600 dark:text-[var(--orange-primary)] hover:underline">
              View MCP tool activity log →
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <Button variant="destructive" size="sm" onClick={revokeAll} disabled={revokingAll || items.length === 0}>
            {revokingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
            <span className="ml-2">Revoke all tokens</span>
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-[var(--bg-elevated)] border border-gray-200 dark:border-[var(--border-subtle)] rounded-lg overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)] py-12 text-center">
            No active OAuth connections. Authorize Claude via Settings → Connectors to create one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[var(--border-subtle)] bg-gray-50 dark:bg-[var(--bg-elevated-hover)]">
                  <th className="text-left px-4 py-3 font-medium">Client</th>
                  <th className="text-left px-4 py-3 font-medium">Issued</th>
                  <th className="text-left px-4 py-3 font-medium">Expires</th>
                  <th className="text-left px-4 py-3 font-medium">Last used</th>
                  <th className="text-left px-4 py-3 font-medium">Scope</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 dark:border-[var(--border-subtle)] hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.clientName}</p>
                      <p className="text-xs text-gray-500 font-mono">{item.clientId}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{format(new Date(item.createdAt), 'PPp')}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{format(new Date(item.expiresAt), 'PPp')}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.lastUsedAt ? format(new Date(item.lastUsedAt), 'PPp') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">{item.scope}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={revoking === item.id}
                        onClick={() => revoke(item.id)}
                      >
                        {revoking === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Revoke'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

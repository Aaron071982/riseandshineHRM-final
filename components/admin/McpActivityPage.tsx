'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw } from 'lucide-react'

type McpLogItem = {
  id: string
  tool: string
  argsSummary: Record<string, unknown>
  resultSummary: Record<string, unknown>
  createdAt: string
}

type ApiResponse = {
  items: McpLogItem[]
  total: number
  page: number
  limit: number
  tools: string[]
}

function formatSummary(obj: Record<string, unknown>): string {
  if (Object.keys(obj).length === 0) return '—'
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ')
}

export default function McpActivityPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tool, setTool] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (tool) params.set('tool', tool)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      const res = await fetch(`/api/admin/mcp-activity?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as ApiResponse
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, tool, startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            MCP Connector Activity
          </h1>
          <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)] mt-1">
            Audit trail of all tool calls made through the Claude MCP connector.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end bg-white dark:bg-[var(--bg-elevated)] border border-gray-200 dark:border-[var(--border-subtle)] rounded-lg p-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tool</label>
          <select
            value={tool}
            onChange={(e) => {
              setTool(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm"
          >
            <option value="">All tools</option>
            {(data?.tools ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-gray-300 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-input)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[var(--bg-elevated)] border border-gray-200 dark:border-[var(--border-subtle)] rounded-lg overflow-hidden">
        {loading && !data ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-[var(--text-tertiary)] py-12 text-center">
            No MCP tool calls recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[var(--border-subtle)] bg-gray-50 dark:bg-[var(--bg-elevated-hover)]">
                  <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium">Tool</th>
                  <th className="text-left px-4 py-3 font-medium">Arguments</th>
                  <th className="text-left px-4 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 dark:border-[var(--border-subtle)] hover:bg-gray-50 dark:hover:bg-[var(--bg-elevated-hover)]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-[var(--text-secondary)]">
                      {format(new Date(item.createdAt), 'PPp')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{item.tool}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-[var(--text-secondary)] max-w-xs truncate">
                      {formatSummary(item.argsSummary)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-[var(--text-secondary)] max-w-xs truncate">
                      {formatSummary(item.resultSummary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {data.page} of {totalPages} ({data.total} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

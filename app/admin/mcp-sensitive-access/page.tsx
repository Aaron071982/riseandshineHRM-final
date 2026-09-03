import Link from 'next/link'
import { loadSensitiveAccessLogs } from '@/lib/mcp/admin/data'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['', 'PAY', 'WORKED_SESSIONS', 'PAYROLL', 'DOCUMENT', 'OTHER'] as const
const ACTIONS = ['', 'READ', 'BLOCKED_UNAUTHORIZED', 'BLOCKED_SCOPE'] as const

export default async function McpSensitiveAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; action?: string; days?: string }>
}) {
  const sp = await searchParams
  const days = Math.min(parseInt(sp.days ?? '7', 10) || 7, 90)
  const logs = await loadSensitiveAccessLogs({
    category: sp.category,
    action: sp.action,
    days,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Admin
        </p>
        <h1 className="text-2xl font-semibold">MCP sensitive access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Super-admin pay/comp reads and denied attempts. Filter by category (PAY, PAYROLL, WORKED_SESSIONS).
        </p>
        <div className="mt-2 flex gap-3 text-sm">
          <Link href="/admin/mcp-activity" className="text-primary hover:underline">
            Tool activity
          </Link>
          <Link href="/admin/mcp-connections" className="text-primary hover:underline">
            Connections &amp; allowlists
          </Link>
        </div>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <label className="text-sm">
          Category
          <select
            name="category"
            defaultValue={sp.category ?? ''}
            className="mt-1 block rounded-md border px-2 py-1.5 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c || 'all'} value={c}>
                {c || 'All'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Action
          <select
            name="action"
            defaultValue={sp.action ?? ''}
            className="mt-1 block rounded-md border px-2 py-1.5 text-sm"
          >
            {ACTIONS.map((a) => (
              <option key={a || 'all'} value={a}>
                {a || 'All'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Days
          <input
            name="days"
            type="number"
            min={1}
            max={90}
            defaultValue={String(days)}
            className="mt-1 block w-20 rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Tool</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Range</th>
              <th className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No sensitive access events in this window.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {log.createdAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {log.user.email ?? log.user.name ?? log.userId}
                  </td>
                  <td className="px-3 py-2 text-xs font-medium">{log.category}</td>
                  <td className="px-3 py-2">
                    {log.action.startsWith('BLOCKED') ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
                        {log.action}
                      </span>
                    ) : (
                      <span className="text-xs">{log.action}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{log.toolName}</td>
                  <td className="px-3 py-2 text-xs">{log.subjectLabel ?? log.subjectId ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {log.dateRangeFrom && log.dateRangeTo
                      ? `${log.dateRangeFrom.toISOString().slice(0, 10)} → ${log.dateRangeTo.toISOString().slice(0, 10)}`
                      : '—'}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-muted-foreground">
                    {log.reason ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { loadDocumentAccessLogs } from '@/lib/mcp/admin/data'

export const dynamic = 'force-dynamic'

const ACTIONS = [
  '',
  'LINK_ISSUED',
  'TEXT_RETURNED',
  'BLOCKED_TYPE',
  'BLOCKED_UNAUTHORIZED',
] as const

export default async function McpDocumentAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; type?: string; days?: string }>
}) {
  const sp = await searchParams
  const days = Math.min(parseInt(sp.days ?? '7', 10) || 7, 90)
  const logs = await loadDocumentAccessLogs({
    action: sp.action,
    documentType: sp.type,
    days,
    limit: 300,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Admin
        </p>
        <h1 className="text-2xl font-semibold">MCP document access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every document-content attempt is logged here, including refusals. Blocked events also notify admins.
        </p>
        <div className="mt-2 flex gap-3 text-sm">
          <Link href="/admin/mcp-activity" className="text-primary hover:underline">
            Tool activity
          </Link>
          <Link href="/admin/mcp-connections" className="text-primary hover:underline">
            Connections &amp; allowlist
          </Link>
        </div>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
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
          Doc type
          <input
            name="type"
            defaultValue={sp.type ?? ''}
            placeholder="parent_id"
            className="mt-1 block rounded-md border px-2 py-1.5 text-sm"
          />
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
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No document access events in this window.
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
                  <td className="px-3 py-2">
                    {log.action.startsWith('BLOCKED') ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
                        {log.action}
                      </span>
                    ) : (
                      <span className="text-xs">{log.action}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{log.documentType}</td>
                  <td className="px-3 py-2 text-xs">
                    {log.serviceClient
                      ? `${log.serviceClient.clientCode} ${log.serviceClient.firstName} ${log.serviceClient.lastName}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">{log.mode ?? '—'}</td>
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

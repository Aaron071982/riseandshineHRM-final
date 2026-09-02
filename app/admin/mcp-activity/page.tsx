import Link from 'next/link'
import { loadMcpActivityLogs } from '@/lib/mcp/admin/data'
import { MCP_TOOL_NAMES } from '@/lib/mcp/toolNames'

export const dynamic = 'force-dynamic'

export default async function McpActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string; phi?: string; days?: string }>
}) {
  const sp = await searchParams
  const days = Math.min(parseInt(sp.days ?? '7', 10) || 7, 90)
  const from = new Date()
  from.setDate(from.getDate() - days)

  const logs = await loadMcpActivityLogs({
    tool: sp.tool,
    from,
    phiOnly: sp.phi === '1',
    limit: 200,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Admin
        </p>
        <h1 className="text-2xl font-semibold">MCP Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tool calls from the Claude MCP connector. PHI access events are flagged.
        </p>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4"
      >
        <label className="text-sm">
          Tool
          <select
            name="tool"
            defaultValue={sp.tool ?? ''}
            className="mt-1 block rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">All tools</option>
            {MCP_TOOL_NAMES.map((t) => (
              <option key={t} value={t}>
                {t}
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="phi" value="1" defaultChecked={sp.phi === '1'} />
          PHI access only
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Filter
        </button>
        <Link href="/admin/mcp-connections" className="text-sm text-primary hover:underline">
          Manage connections →
        </Link>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Tool</th>
              <th className="px-3 py-2">PHI</th>
              <th className="px-3 py-2">Client ref</th>
              <th className="px-3 py-2">Auth</th>
              <th className="px-3 py-2">Summary</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No MCP tool calls in this window.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const meta = (log.metadata ?? {}) as Record<string, unknown>
                return (
                  <tr key={log.id} className="border-t">
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {log.createdAt.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{log.action}</td>
                    <td className="px-3 py-2">
                      {log.resourceType === 'MCP_PHI' || meta.phiAccess ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
                          PHI
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {String(meta.clientIdRef ?? log.resourceId ?? '—')}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {String(meta.authMethod ?? '—')}
                      {meta.oauthClientId ? (
                        <span className="block text-muted-foreground">
                          {String(meta.oauthClientId).slice(0, 12)}…
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-xs text-muted-foreground">
                      {JSON.stringify(meta.resultSummary ?? meta.args ?? {})}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

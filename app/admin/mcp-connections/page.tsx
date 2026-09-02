import Link from 'next/link'
import { loadMcpConnections } from '@/lib/mcp/admin/data'
import { revokeAllMcpTokens, revokeMcpToken } from '@/lib/mcp/admin/actions'

export const dynamic = 'force-dynamic'

function parseScopes(scope: string): string[] {
  return scope.split(/\s+/).filter(Boolean)
}

export default async function McpConnectionsPage() {
  const { clients, tokens } = await loadMcpConnections()

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Admin
        </p>
        <h1 className="text-2xl font-semibold">MCP Connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active OAuth tokens for the Claude MCP connector. Revoke access immediately if needed.
        </p>
        <Link href="/admin/mcp-activity" className="mt-2 inline-block text-sm text-primary hover:underline">
          ← View activity log
        </Link>
      </header>

      <form
        action={async () => {
          'use server'
          await revokeAllMcpTokens()
        }}
        className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
      >
        <p className="text-sm font-medium text-red-900 dark:text-red-200">
          Emergency: revoke all active MCP tokens
        </p>
        <button
          type="submit"
          className="mt-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Revoke all tokens
        </button>
      </form>

      <section className="rounded-lg border">
        <h2 className="border-b px-4 py-3 font-medium">
          Active tokens ({tokens.length})
        </h2>
        {tokens.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No active tokens.</p>
        ) : (
          <ul className="divide-y">
            {tokens.map((t) => {
              const scopes = parseScopes(t.scope)
              return (
                <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="text-sm">
                    <p className="font-medium">{t.client.clientName}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {t.id.slice(0, 12)}…
                    </p>
                    <p className="mt-1 text-xs">
                      Scopes:{' '}
                      {scopes.map((s) => (
                        <span
                          key={s}
                          className={
                            s === 'mcp:phi'
                              ? 'mr-1 rounded bg-red-100 px-1 text-red-800'
                              : 'mr-1'
                          }
                        >
                          {s}
                        </span>
                      ))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Issued {t.createdAt.toLocaleString()} · Expires{' '}
                      {t.expiresAt.toLocaleString()}
                      {t.lastUsedAt
                        ? ` · Last used ${t.lastUsedAt.toLocaleString()}`
                        : ''}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      'use server'
                      await revokeMcpToken(t.id)
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      Revoke
                    </button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border">
        <h2 className="border-b px-4 py-3 font-medium">
          Registered OAuth clients ({clients.length})
        </h2>
        <ul className="divide-y text-sm">
          {clients.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <p className="font-medium">{c.clientName}</p>
              <p className="font-mono text-xs text-muted-foreground">{c.id}</p>
              <p className="text-xs text-muted-foreground">
                Registered {c.createdAt.toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

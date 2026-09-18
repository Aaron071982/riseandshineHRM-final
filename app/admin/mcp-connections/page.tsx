import Link from 'next/link'
import {
  loadBulkImportGrantUsers,
  loadDocumentReadAllowlistUsers,
  loadMcpConnections,
  loadPendingBulkImportApprovals,
} from '@/lib/mcp/admin/data'
import {
  approveScheduleBulkImportBatch,
  revokeAllMcpTokens,
  revokeMcpToken,
  setCanBulkImportSchedule,
  setCanBulkImportScheduleByEmail,
  setCanReadClientDocuments,
  setMcpSuperAdmin,
} from '@/lib/mcp/admin/actions'
import { userCanReadClientDocuments } from '@/lib/mcp/documentAllowlist'
import {
  isMcpSuperAdminEmail,
  userIsMcpSuperAdmin,
} from '@/lib/mcp/superAdminAllowlist'

export const dynamic = 'force-dynamic'

function parseScopes(scope: string): string[] {
  return scope.split(/\s+/).filter(Boolean)
}

export default async function McpConnectionsPage() {
  const { clients, tokens } = await loadMcpConnections()
  const allowlistUsers = await loadDocumentReadAllowlistUsers()
  const bulkImportUsers = await loadBulkImportGrantUsers()
  const pendingBulkImports = await loadPendingBulkImportApprovals()

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
        <span className="mx-2 text-muted-foreground">·</span>
        <Link href="/admin/mcp-document-access" className="text-sm text-primary hover:underline">
          Document access
        </Link>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link href="/admin/mcp-sensitive-access" className="text-sm text-primary hover:underline">
          Sensitive / pay access
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
                            s === 'mcp:phi' ||
                            s === 'mcp:phi:documents' ||
                            s === 'mcp:superadmin'
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
          Document-read allowlist
        </h2>
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          CRM SUPER_ADMIN and INTAKE roles always qualify. The toggle grants others explicitly.
          Scope mcp:phi:documents is still required.
        </p>
        <ul className="divide-y">
          {allowlistUsers.map((u) => {
            const viaRole = userCanReadClientDocuments({
              id: u.id,
              email: u.email,
              canReadClientDocuments: false,
              crmRoles: u.crmRoles.map((r) => r.role),
            })
            const allowed = userCanReadClientDocuments({
              id: u.id,
              email: u.email,
              canReadClientDocuments: u.canReadClientDocuments,
              crmRoles: u.crmRoles.map((r) => r.role),
            })
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{u.name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-xs">
                    {allowed ? (
                      <span className="text-green-700">Allowed</span>
                    ) : (
                      <span className="text-muted-foreground">Not allowed</span>
                    )}
                    {viaRole ? ' · via SUPER_ADMIN/INTAKE role' : ''}
                    {u.canReadClientDocuments ? ' · explicit flag' : ''}
                  </p>
                </div>
                <form
                  action={async () => {
                    'use server'
                    await setCanReadClientDocuments(u.id, !u.canReadClientDocuments)
                  }}
                >
                  <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                    {u.canReadClientDocuments ? 'Clear flag' : 'Grant flag'}
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-lg border">
        <h2 className="border-b px-4 py-3 font-medium">
          MCP super-admin (pay / compensation)
        </h2>
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          Hardcoded executives: irsal@, kazi@, siyam@, shazia@, fardeen@ (@riseandshineaba.com).
          Scope mcp:superadmin is still required. Read-only — no writes.
        </p>
        <ul className="divide-y">
          {allowlistUsers.map((u) => {
            const viaEmail = isMcpSuperAdminEmail(u.email)
            const allowed = userIsMcpSuperAdmin({
              id: u.id,
              email: u.email,
              isMcpSuperAdmin: u.isMcpSuperAdmin,
            })
            return (
              <li key={`sa-${u.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{u.name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-xs">
                    {allowed ? (
                      <span className="text-green-700">Allowed</span>
                    ) : (
                      <span className="text-muted-foreground">Not allowed</span>
                    )}
                    {viaEmail ? ' · named executive email' : ''}
                    {u.isMcpSuperAdmin ? ' · flag' : ''}
                  </p>
                </div>
                <form
                  action={async () => {
                    'use server'
                    await setMcpSuperAdmin(u.id, !u.isMcpSuperAdmin)
                  }}
                >
                  <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                    {u.isMcpSuperAdmin ? 'Clear flag' : 'Grant flag'}
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-amber-200 dark:border-amber-900">
        <h2 className="border-b px-4 py-3 font-medium">
          Schedule bulk import (schedule:bulk_import)
        </h2>
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          One-time grant. Default off. MCP tools preview_schedule_import / commit_schedule_import /
          rollback_schedule_import require OAuth identity + this flag on every call. Revoke after the import.
        </p>
        <form
          action={async (formData) => {
            'use server'
            const email = String(formData.get('email') ?? '')
            await setCanBulkImportScheduleByEmail(email, true)
          }}
          className="flex flex-wrap items-end gap-2 border-b px-4 py-3"
        >
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Grant by email</span>
            <input
              name="email"
              type="email"
              required
              placeholder="staff@riseandshineaba.com"
              className="rounded-md border px-2 py-1.5 text-sm"
            />
          </label>
          <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            Grant
          </button>
        </form>
        <ul className="divide-y">
          {bulkImportUsers.map((u) => (
            <li
              key={`bulk-${u.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{u.name || u.email}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                <p className="text-xs">
                  {u.canBulkImportSchedule ? (
                    <span className="text-amber-700 dark:text-amber-300">Grant active</span>
                  ) : (
                    <span className="text-muted-foreground">No grant</span>
                  )}
                </p>
              </div>
              <form
                action={async () => {
                  'use server'
                  await setCanBulkImportSchedule(u.id, !u.canBulkImportSchedule)
                }}
              >
                <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                  {u.canBulkImportSchedule ? 'Revoke' : 'Grant'}
                </button>
              </form>
            </li>
          ))}
        </ul>
        {pendingBulkImports.length > 0 ? (
          <div className="border-t">
            <h3 className="px-4 py-2 text-sm font-medium">
              Pending admin approval ({pendingBulkImports.length})
            </h3>
            <ul className="divide-y">
              {pendingBulkImports.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {b.okCount} ok / {b.conflictCount} conflict / {b.errorCount} error ·{' '}
                      {b.entryCount} rows
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.actor.name || b.actor.email} · {b.status} · expires{' '}
                      {b.expiresAt.toLocaleString()}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{b.id}</p>
                  </div>
                  <form
                    action={async () => {
                      'use server'
                      await approveScheduleBulkImportBatch(b.id)
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      Approve commit
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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

'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import type { CrmRole } from '@prisma/client'
import {
  grantCrmRole,
  listCrmUsersWithRoles,
  revokeCrmRole,
} from '@/lib/crm/roleActions'
import { getTrainingCompletionSummaries } from '@/lib/crm/training/actions'
import { CRM_DEPARTMENT_ROLES } from '@/lib/crm/roleConstants'
import {
  CRM_ROLE_OPTIONS,
  CRM_ROLE_PRIVILEGES,
} from '@/lib/crm/rolePrivileges'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'
import { cn } from '@/lib/utils'

type UserRow = {
  id: string
  name: string | null
  email: string | null
  hrmRole: string
  roles: CrmRole[]
  fullAccess: boolean
  superAdmin: boolean
  departments: CrmRole[]
  ownerDepts: string[]
}

export default function AdminManagementClient() {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [grantUserId, setGrantUserId] = useState('')
  const [grantRole, setGrantRole] = useState<CrmRole>('BCBA')
  const [revokeTarget, setRevokeTarget] = useState<{
    userId: string
    role: CrmRole
    name: string
  } | null>(null)
  const [trainingPct, setTrainingPct] = useState<Record<string, number>>({})
  const [showMatrix, setShowMatrix] = useState(true)

  const load = useCallback((query?: string) => {
    startTransition(async () => {
      setError('')
      const res = await listCrmUsersWithRoles(query)
      if (!res.ok) {
        setError(res.error)
        setUsers([])
        return
      }
      setUsers(res.users)
      const ids = res.users.map((u) => u.id)
      if (ids.length) {
        const t = await getTrainingCompletionSummaries(ids)
        if (t.ok) {
          const map: Record<string, number> = {}
          for (const [uid, s] of Object.entries(t.summaries)) {
            map[uid] = s.percent
          }
          setTrainingPct(map)
        }
      }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onGrant = () => {
    if (!grantUserId) {
      setError('Pick a user first')
      return
    }
    startTransition(async () => {
      setError('')
      setMessage('')
      const res = await grantCrmRole(grantUserId, grantRole)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setMessage(`Granted ${grantRole}`)
      load(q)
    })
  }

  const onRevoke = (userId: string, role: CrmRole, name: string) => {
    setRevokeTarget({ userId, role, name })
  }

  const confirmRevoke = () => {
    if (!revokeTarget) return
    const { userId, role } = revokeTarget
    startTransition(async () => {
      setError('')
      setMessage('')
      const res = await revokeCrmRole(userId, role)
      if (!res.ok) {
        setError(res.error)
        return
      }
      if (res.warned) setMessage(res.warned)
      else setMessage(`Revoked ${role}`)
      setRevokeTarget(null)
      load(q)
    })
  }

  const bcbaUsers = users.filter(
    (u) => u.hrmRole === 'BCBA' || u.roles.includes('BCBA') || u.roles.includes('CLINICAL_LEAD')
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Roles &amp; privileges
        </h1>
        <p className="mt-0.5 text-sm text-quiet">
          Control what each person can see and do in Client Services — including
          BCBAs. Super-admin only. Open this page anytime from the sidebar{' '}
          <strong className="text-ink">Admin</strong> link.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-[var(--green-bg)] px-3 py-2 text-sm text-[var(--green)]">
          {message}
        </p>
      )}

      <section className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-ink">
              Privilege matrix — what each role unlocks
            </h2>
            <p className="text-xs text-quiet">
              Granting a role below applies these privileges immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMatrix((v) => !v)}
            className="text-xs font-medium text-[var(--sunrise-dark)] hover:underline"
          >
            {showMatrix ? 'Hide' : 'Show'}
          </button>
        </div>
        {showMatrix ? (
          <div className="divide-y divide-line-2">
            {(['Leadership', 'Departments', 'Clinical portal'] as const).map(
              (group) => (
                <div key={group} className="px-4 py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                    {group}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {CRM_ROLE_PRIVILEGES.filter((r) => r.group === group).map(
                      (r) => (
                        <div
                          key={r.role}
                          className="rounded-lg border border-line bg-line-2/30 p-3"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">
                              {r.label}
                            </p>
                            <span className="text-[10px] font-medium uppercase tracking-wide text-faint">
                              {r.role.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-quiet">{r.summary}</p>
                          <ul className="mt-2 space-y-1 text-xs text-ink">
                            {r.privileges.map((p) => (
                              <li key={p} className="flex gap-1.5">
                                <span className="text-[var(--sunrise)]">•</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Grant role</h2>
        <p className="mt-0.5 text-xs text-quiet">
          Works for HRM Admins and BCBA login accounts (created from Add BCBA in
          HRM). Pick BCBA / Clinical lead for portal access, or a department role
          for full CRM queues.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[14rem] flex-1">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
              User
            </span>
            <select
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm"
            >
              <option value="">Select…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email || u.id}
                  {u.email ? ` · ${u.email}` : ''}
                  {u.hrmRole === 'BCBA' ? ' · BCBA' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="w-52">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
              Role / privilege
            </span>
            <select
              value={grantRole}
              onChange={(e) => setGrantRole(e.target.value as CrmRole)}
              className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm"
            >
              {CRM_ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={onGrant}
            className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-60"
          >
            Grant
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[color-mix(in_srgb,var(--sunrise)_35%,var(--line))] bg-[color-mix(in_srgb,var(--sunrise)_6%,white)] p-4">
        <h2 className="font-display text-sm font-semibold text-ink">
          BCBA &amp; clinical portal accounts
        </h2>
        <p className="mt-0.5 text-xs text-quiet">
          Assign <strong>BCBA</strong> (caseload) or <strong>Clinical lead</strong>{' '}
          (all clients, clinical tabs). Add department / Management roles if they
          should leave the limited portal and use full CRM.
        </p>
        {bcbaUsers.length === 0 ? (
          <p className="mt-3 text-sm text-quiet">
            No BCBA / clinical-lead accounts yet. Create one in HRM → Add Employee
            → Add BCBA, then grant roles here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60 rounded-lg border border-line bg-surface">
            {bcbaUsers.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <div>
                  <Link
                    href={`/client-services/profile/${u.id}`}
                    className="font-medium text-[var(--sunrise-dark)] hover:underline"
                  >
                    {u.name || u.email || u.id}
                  </Link>
                  <div className="text-xs text-quiet">
                    {u.email} · HRM {u.hrmRole}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.roles.length === 0 ? (
                    <span className="text-xs text-faint">No CRM roles</span>
                  ) : (
                    u.roles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        title="Click to revoke"
                        onClick={() =>
                          onRevoke(u.id, role, u.name || u.email || u.id)
                        }
                        className="rounded-md border border-line bg-line-2 px-2 py-0.5 text-[11px] font-medium hover:border-[var(--urgent)]"
                      >
                        {role.replace(/_/g, ' ')} ×
                      </button>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-display text-sm font-semibold text-ink">
            All CRM users
          </h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') load(q)
            }}
            placeholder="Search name or email"
            className="h-9 min-w-[16rem] flex-1 rounded-lg border border-line bg-surface px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => load(q)}
            className="h-9 rounded-lg border border-line px-3 text-sm hover:bg-line-2"
          >
            Search
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-line-2/40 text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2.5 font-medium">User</th>
                <th className="px-3 py-2.5 font-medium">Account</th>
                <th className="px-3 py-2.5 font-medium">Roles</th>
                <th className="px-3 py-2.5 font-medium">Training</th>
                <th className="px-3 py-2.5 font-medium">Access</th>
                <th className="px-3 py-2.5 font-medium">Departments</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-quiet">
                    {pending ? 'Loading…' : 'No users found'}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-line-2 align-top">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/client-services/profile/${u.id}`}
                        className="font-medium text-[var(--sunrise-dark)] hover:underline"
                      >
                        {u.name || '—'}
                      </Link>
                      <div className="text-xs text-quiet">{u.email || u.id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-quiet">
                      {u.hrmRole}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && (
                          <span className="text-xs text-faint">None</span>
                        )}
                        {u.roles.map((role) => (
                          <button
                            key={role}
                            type="button"
                            title="Click to revoke"
                            onClick={() =>
                              onRevoke(u.id, role, u.name || u.email || u.id)
                            }
                            className={cn(
                              'rounded-md border px-2 py-0.5 text-[11px] font-medium',
                              role === 'SUPER_ADMIN'
                                ? 'border-[var(--urgent)] bg-[var(--urgent-bg)] text-[var(--urgent)]'
                                : role === 'BCBA' || role === 'CLINICAL_LEAD'
                                  ? 'border-[color-mix(in_srgb,var(--sunrise)_40%,var(--line))] bg-[color-mix(in_srgb,var(--sunrise)_10%,white)] text-ink'
                                  : 'border-line bg-line-2 text-ink hover:border-[var(--urgent)]'
                            )}
                          >
                            {role.replace(/_/g, ' ')} ×
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {trainingPct[u.id] !== undefined ? (
                        <Link
                          href={`/client-services/profile/${u.id}`}
                          className={cn(
                            'font-medium tabular-nums',
                            trainingPct[u.id] >= 100
                              ? 'text-[var(--green)]'
                              : 'text-quiet hover:text-ink'
                          )}
                        >
                          {trainingPct[u.id]}%
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {u.superAdmin && (
                        <div className="font-medium text-[var(--urgent)]">
                          Super admin
                        </div>
                      )}
                      {u.fullAccess && (
                        <div className="text-[var(--green)]">Full access</div>
                      )}
                      {!u.fullAccess && !u.superAdmin && (
                        <div className="text-quiet">Scoped</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-quiet">
                      {u.departments.length === 0
                        ? '—'
                        : u.departments
                            .map((d) => d.replace(/_/g, ' '))
                            .join(', ')}
                      {u.ownerDepts.length > 0 && (
                        <div className="mt-0.5 text-[10px] text-faint">
                          Owns: {u.ownerDepts.join(', ')}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-faint">
          Department roles: {(CRM_DEPARTMENT_ROLES as readonly string[]).join(', ')}.
          Click a role chip to revoke. Last SUPER_ADMIN cannot be removed.
        </p>
      </section>
      <ConfirmDestructiveDialog
        open={!!revokeTarget}
        onOpenChange={(o) => {
          if (!o) setRevokeTarget(null)
        }}
        title="Revoke CRM role?"
        description={
          revokeTarget
            ? `Revoke ${CRM_ROLE_OPTIONS.find((r) => r.value === revokeTarget.role)?.label ?? revokeTarget.role} from ${revokeTarget.name}.\n\nHistory is kept (revokedAt is set). An audit log is written.`
            : ''
        }
        confirmLabel="Revoke role"
        pending={pending}
        onConfirm={confirmRevoke}
      />
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { CrmRole } from '@prisma/client'
import {
  grantCrmRole,
  listCrmUsersWithRoles,
  revokeCrmRole,
} from '@/lib/crm/roleActions'
import { CRM_DEPARTMENT_ROLES } from '@/lib/crm/roleConstants'
import { cn } from '@/lib/utils'

const ROLE_OPTIONS: { value: CrmRole; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super admin' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'INTAKE', label: 'Intake' },
  { value: 'CLINICAL', label: 'Clinical' },
  { value: 'AUTHORIZATION', label: 'Authorization' },
  { value: 'STAFFING', label: 'Staffing' },
  { value: 'CASE_COORDINATION', label: 'Case coordination' },
  { value: 'BILLING', label: 'Billing' },
]

type UserRow = {
  id: string
  name: string | null
  email: string | null
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
  const [grantRole, setGrantRole] = useState<CrmRole>('INTAKE')

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

  const onRevoke = (userId: string, role: CrmRole) => {
    const label = ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role
    if (
      !window.confirm(
        `Revoke ${label}? This keeps history (sets revokedAt) and writes an audit log.`
      )
    ) {
      return
    }
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
      load(q)
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Admin Management
        </h1>
        <p className="mt-0.5 text-sm text-quiet">
          Grant and revoke CRM roles. Super-admin only. HRM UserRole is unchanged.
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

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Grant role</h2>
        <p className="mt-0.5 text-xs text-quiet">
          User must already exist in users (must log in once first).
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
                </option>
              ))}
            </select>
          </label>
          <label className="w-48">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
              Role
            </span>
            <select
              value={grantRole}
              onChange={(e) => setGrantRole(e.target.value as CrmRole)}
              className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
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
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-line-2/40 text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2.5 font-medium">User</th>
                <th className="px-3 py-2.5 font-medium">Roles</th>
                <th className="px-3 py-2.5 font-medium">Access</th>
                <th className="px-3 py-2.5 font-medium">Departments</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-quiet">
                    {pending ? 'Loading…' : 'No users found'}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-line-2 align-top">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-ink">
                        {u.name || '—'}
                      </div>
                      <div className="text-xs text-quiet">{u.email || u.id}</div>
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
                            onClick={() => onRevoke(u.id, role)}
                            className={cn(
                              'rounded-md border px-2 py-0.5 text-[11px] font-medium',
                              role === 'SUPER_ADMIN'
                                ? 'border-[var(--urgent)] bg-[var(--urgent-bg)] text-[var(--urgent)]'
                                : 'border-line bg-line-2 text-ink hover:border-[var(--urgent)]'
                            )}
                          >
                            {role.replace(/_/g, ' ')} ×
                          </button>
                        ))}
                      </div>
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
          Click a role chip to revoke (soft). Last SUPER_ADMIN cannot be removed.
        </p>
      </section>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthStatus, AuthType } from '@prisma/client'
import {
  addAuthorizationLine,
  createAuthorization,
  deleteAuthorizationLine,
  updateAuthorization,
  updateAuthorizationLine,
} from '@/lib/crm/actions'
import { CPT_CODES } from '@/lib/crm/cpt'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'
import {
  EXPIRY_TONE_CLASS,
  UnitsBar,
  expiryBand,
} from '@/components/crm/ProfilePicker'
import { cn } from '@/lib/utils'

type Line = {
  id: string
  cptCode: string
  unitsRequested: number | null
  unitsApproved: number | null
  isUnderApproved: boolean
  unitsAuthorized: number
  unitsUsed: number
  description: string | null
}

type Auth = {
  id: string
  authType: AuthType
  payerPlan: string | null
  payerName: string
  authNumber: string | null
  status: AuthStatus
  effectiveDate: string | Date | null
  expirationDate: string | Date | null
  renderingProvider: string | null
  notes: string | null
  lines: Line[]
}

const AUTH_STATUSES: AuthStatus[] = [
  'REQUESTED',
  'PENDING',
  'APPROVED',
  'DENIED',
  'EXPIRED',
]

export function AuthorizationPanel({
  clientId,
  authorizations,
  canEdit,
}: {
  clientId: string
  authorizations: Auth[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    authType: 'TREATMENT' as AuthType,
    payerPlan: '',
    payerName: '',
    authNumber: '',
    status: 'REQUESTED' as AuthStatus,
    effectiveDate: '',
    expirationDate: '',
    renderingProvider: '',
  })

  const assessment = authorizations.filter((a) => a.authType === 'ASSESSMENT')
  const treatment = authorizations.filter((a) => a.authType === 'TREATMENT')

  const create = () => {
    startTransition(async () => {
      setError('')
      const res = await createAuthorization(clientId, {
        authType: form.authType,
        payerPlan: form.payerPlan,
        payerName: form.payerName || form.payerPlan,
        authNumber: form.authNumber || null,
        status: form.status,
        effectiveDate: form.effectiveDate || null,
        expirationDate: form.expirationDate || null,
        renderingProvider: form.renderingProvider || null,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setShowForm(false)
      setForm({
        authType: 'TREATMENT',
        payerPlan: '',
        payerName: '',
        authNumber: '',
        status: 'REQUESTED',
        effectiveDate: '',
        expirationDate: '',
        renderingProvider: '',
      })
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-quiet">
          Track assessment and treatment authorizations, CPT units, and expiry.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2"
          >
            {showForm ? 'Cancel' : 'Add authorization'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="grid gap-2 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
          <Select
            label="Type"
            value={form.authType}
            onChange={(v) => setForm((f) => ({ ...f, authType: v as AuthType }))}
            options={[
              { value: 'ASSESSMENT', label: 'Assessment' },
              { value: 'TREATMENT', label: 'Treatment' },
            ]}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v as AuthStatus }))}
            options={AUTH_STATUSES.map((s) => ({
              value: s,
              label: s.replace(/_/g, ' '),
            }))}
          />
          <Field
            label="Payer plan"
            value={form.payerPlan}
            onChange={(v) => setForm((f) => ({ ...f, payerPlan: v }))}
          />
          <Field
            label="Payer (optional display)"
            value={form.payerName}
            onChange={(v) => setForm((f) => ({ ...f, payerName: v }))}
          />
          <Field
            label="Auth #"
            value={form.authNumber}
            onChange={(v) => setForm((f) => ({ ...f, authNumber: v }))}
          />
          <Field
            label="Effective"
            type="date"
            value={form.effectiveDate}
            onChange={(v) => setForm((f) => ({ ...f, effectiveDate: v }))}
          />
          <Field
            label="Expiration"
            type="date"
            value={form.expirationDate}
            onChange={(v) => setForm((f) => ({ ...f, expirationDate: v }))}
          />
          <Field
            label="Rendering provider"
            value={form.renderingProvider}
            onChange={(v) => setForm((f) => ({ ...f, renderingProvider: v }))}
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="button"
              disabled={pending || !form.payerPlan.trim()}
              onClick={create}
              className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              Save authorization
            </button>
          </div>
        </div>
      )}

      {authorizations.length === 0 && (
        <Empty body="No authorizations on file yet — add one to start tracking units." />
      )}

      <AuthGroup
        title="Assessment"
        items={assessment}
        canEdit={canEdit}
        pending={pending}
        startTransition={startTransition}
        setError={setError}
        onDone={() => router.refresh()}
      />
      <AuthGroup
        title="Treatment"
        items={treatment}
        canEdit={canEdit}
        pending={pending}
        startTransition={startTransition}
        setError={setError}
        onDone={() => router.refresh()}
      />
    </div>
  )
}

function AuthGroup({
  title,
  items,
  canEdit,
  pending,
  startTransition,
  setError,
  onDone,
}: {
  title: string
  items: Auth[]
  canEdit: boolean
  pending: boolean
  startTransition: (fn: () => void) => void
  setError: (s: string) => void
  onDone: () => void
}) {
  if (items.length === 0) return null
  return (
    <section className="space-y-3">
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {items.map((auth) => (
        <AuthCard
          key={auth.id}
          auth={auth}
          canEdit={canEdit}
          pending={pending}
          startTransition={startTransition}
          setError={setError}
          onDone={onDone}
        />
      ))}
    </section>
  )
}

function AuthCard({
  auth,
  canEdit,
  pending,
  startTransition,
  setError,
  onDone,
}: {
  auth: Auth
  canEdit: boolean
  pending: boolean
  startTransition: (fn: () => void) => void
  setError: (s: string) => void
  onDone: () => void
}) {
  const band = expiryBand(auth.expirationDate)
  const [cpt, setCpt] = useState('97153')
  const [units, setUnits] = useState('100')
  const [removeLineId, setRemoveLineId] = useState<string | null>(null)

  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-ink">{auth.payerPlan || auth.payerName}</h4>
            <span className="rounded-md bg-line-2 px-2 py-0.5 text-[11px] font-medium text-quiet">
              {auth.status.replace(/_/g, ' ')}
            </span>
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums',
                EXPIRY_TONE_CLASS[band.tone]
              )}
            >
              {band.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-quiet">
            Auth # {auth.authNumber || '—'}
            {' · '}
            Eff{' '}
            {auth.effectiveDate
              ? new Date(auth.effectiveDate).toLocaleDateString()
              : '—'}
            {' · '}
            Exp{' '}
            {auth.expirationDate
              ? new Date(auth.expirationDate).toLocaleDateString()
              : '—'}
          </p>
          <p className="text-xs text-quiet">
            Rendering: {auth.renderingProvider || '—'}
          </p>
        </div>
        {canEdit && (
          <select
            disabled={pending}
            value={auth.status}
            onChange={(e) => {
              const status = e.target.value as AuthStatus
              startTransition(async () => {
                setError('')
                const res = await updateAuthorization(auth.id, { status })
                if (!res.ok) setError(res.error)
                onDone()
              })
            }}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-xs focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
          >
            {AUTH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        )}
      </div>

      <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
        {auth.lines.length === 0 && (
          <li className="px-3 py-2 text-sm text-quiet">No CPT lines yet.</li>
        )}
        {auth.lines.map((line) => (
          <li
            key={line.id}
            className="flex flex-wrap items-center gap-3 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium tabular-nums text-ink">
                {line.cptCode}
              </div>
              <div className="text-xs text-quiet">
                {line.description || '—'}
              </div>
            </div>
            <UnitsBar used={line.unitsUsed} authorized={line.unitsAuthorized} />
            {line.isUnderApproved && (
              <span className="rounded bg-[var(--urgent-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--urgent)]">
                Under-approved
              </span>
            )}
            {canEdit && (
              <>
                <input
                  type="number"
                  min={0}
                  defaultValue={line.unitsUsed}
                  disabled={pending}
                  onBlur={(e) => {
                    const unitsUsed = Number(e.target.value)
                    if (!Number.isFinite(unitsUsed) || unitsUsed === line.unitsUsed)
                      return
                    startTransition(async () => {
                      await updateAuthorizationLine(line.id, { unitsUsed })
                      onDone()
                    })
                  }}
                  className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-xs tabular-nums focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
                  title="Units used (manual this phase)"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setRemoveLineId(line.id)}
                  className="text-xs text-[var(--urgent)] hover:underline"
                >
                  Remove
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <select
            value={cpt}
            onChange={(e) => setCpt(e.target.value)}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
          >
            {CPT_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            className="h-9 w-24 rounded-lg border border-line bg-surface px-2 text-sm tabular-nums focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            placeholder="Units"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                setError('')
                const res = await addAuthorizationLine(auth.id, {
                  cptCode: cpt,
                  unitsAuthorized: Number(units) || 0,
                  unitsRequested: Number(units) || 0,
                  unitsApproved: Number(units) || 0,
                })
                if (!res.ok) setError(res.error)
                onDone()
              })
            }}
            className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-line-2"
          >
            Add CPT line
          </button>
        </div>
      )}
      <p className="mt-2 text-[11px] text-faint">
        Units used are editable manually this phase; lines auto-flag when approved units are below requested.
      </p>
      <ConfirmDestructiveDialog
        open={!!removeLineId}
        onOpenChange={(o) => {
          if (!o) setRemoveLineId(null)
        }}
        title="Remove this authorization line?"
        description={(() => {
          const line = auth.lines.find((l) => l.id === removeLineId)
          return `Soft-delete CPT ${line?.cptCode ?? 'line'} (${line?.unitsAuthorized ?? 0} units authorized) on ${auth.payerName}.\n\nThe line stays in the table and an audit log is written.`
        })()}
        confirmLabel="Remove line"
        pending={pending}
        onConfirm={() => {
          if (!removeLineId) return
          startTransition(async () => {
            await deleteAuthorizationLine(removeLineId)
            setRemoveLineId(null)
            onDone()
          })
        }}
      />
    </article>
  )
}

function Empty({ body }: { body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
      <p className="font-display text-base font-semibold text-ink">
        Nothing here yet
      </p>
      <p className="mt-1 text-sm text-quiet">{body}</p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  className?: string
}) {
  return (
    <label className={cn('block text-xs text-quiet', className)}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
      />
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block text-xs text-quiet">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ReferralSignerRole } from '@prisma/client'
import { saveReferralCheck } from '@/lib/crm/actions'
import {
  evaluateReferralValidity,
  REFERRAL_FIELD_LABELS,
  REFERRAL_SIGNER_LABELS,
} from '@/lib/crm/referralValidity'
import { cn } from '@/lib/utils'

const ROLES: ReferralSignerRole[] = [
  'PHYSICIAN',
  'PSYCHOLOGIST',
  'PSYCH_NP',
  'PEDS_NP',
]

export type ReferralCheckShape = {
  signedByRole: ReferralSignerRole | null
  hasAsdDx: boolean
  initialDxDate: Date | string | null
  severitySupportLevel: string | null
  abaRequiredStatement: boolean
  dsm5ChecklistAttached: boolean
  notes: string | null
}

export function ReferralCheckPanel({
  clientId,
  check,
  canEdit,
}: {
  clientId: string
  check: ReferralCheckShape | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    signedByRole: check?.signedByRole ?? ('' as ReferralSignerRole | ''),
    hasAsdDx: check?.hasAsdDx ?? false,
    initialDxDate: check?.initialDxDate
      ? new Date(check.initialDxDate).toISOString().slice(0, 10)
      : '',
    severitySupportLevel: check?.severitySupportLevel ?? '',
    abaRequiredStatement: check?.abaRequiredStatement ?? false,
    dsm5ChecklistAttached: check?.dsm5ChecklistAttached ?? false,
    notes: check?.notes ?? '',
  })

  const evalResult = useMemo(
    () =>
      evaluateReferralValidity({
        signedByRole: form.signedByRole || null,
        hasAsdDx: form.hasAsdDx,
        initialDxDate: form.initialDxDate || null,
        severitySupportLevel: form.severitySupportLevel,
        abaRequiredStatement: form.abaRequiredStatement,
        dsm5ChecklistAttached: form.dsm5ChecklistAttached,
      }),
    [form]
  )

  return (
    <div className="mt-2 rounded-lg border border-line bg-[var(--sunrise-soft)]/40 p-3">
      <p className="text-xs font-medium text-ink">
        NY Medicaid referral validity
        {evalResult.ok ? (
          <span className="ml-2 text-[var(--green)]">Complete</span>
        ) : (
          <span className="ml-2 text-[var(--urgent)]">Incomplete — blocks intake</span>
        )}
      </p>
      {!evalResult.ok && (
        <ul className="mt-1 list-disc pl-4 text-xs text-quiet">
          {evalResult.missing.map((m) => (
            <li key={m}>{REFERRAL_FIELD_LABELS[m] ?? m}</li>
          ))}
        </ul>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-quiet">
          Signed by
          <select
            disabled={!canEdit || pending}
            value={form.signedByRole}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                signedByRole: e.target.value as ReferralSignerRole | '',
              }))
            }
            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs"
          >
            <option value="">—</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {REFERRAL_SIGNER_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-quiet">
          Initial dx date
          <input
            type="date"
            disabled={!canEdit || pending}
            value={form.initialDxDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, initialDxDate: e.target.value }))
            }
            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs"
          />
        </label>
        <label className="text-xs text-quiet sm:col-span-2">
          Severity / support level
          <input
            disabled={!canEdit || pending}
            value={form.severitySupportLevel}
            onChange={(e) =>
              setForm((f) => ({ ...f, severitySupportLevel: e.target.value }))
            }
            className="mt-1 h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs"
          />
        </label>
        {(
          [
            ['hasAsdDx', 'ASD diagnosis on referral'],
            ['abaRequiredStatement', 'Statement that ABA is required'],
            ['dsm5ChecklistAttached', 'DSM-5 checklist attached'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              disabled={!canEdit || pending}
              checked={form[key]}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: e.target.checked }))
              }
            />
            {label}
          </label>
        ))}
      </div>
      {canEdit && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await saveReferralCheck(clientId, {
                signedByRole: form.signedByRole || null,
                hasAsdDx: form.hasAsdDx,
                initialDxDate: form.initialDxDate || null,
                severitySupportLevel: form.severitySupportLevel,
                abaRequiredStatement: form.abaRequiredStatement,
                dsm5ChecklistAttached: form.dsm5ChecklistAttached,
                notes: form.notes,
              })
              router.refresh()
            })
          }}
          className="mt-2 h-8 rounded-lg bg-brand px-3 text-xs font-medium text-white hover:bg-brand-2 disabled:opacity-50"
        >
          Save referral check
        </button>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveConsentInitials } from '@/lib/crm/actions'
import {
  computeConsentBillingReady,
  CONSENT_LINE_DEFS,
  type ConsentLineKey,
  parseConsentLines,
} from '@/lib/crm/consent'
import { cn } from '@/lib/utils'

export type ConsentShape = {
  lines: unknown
  billingReady: boolean
  signatureDate: Date | string | null
  expiresAt: Date | string | null
  signedByName: string | null
  secondParentRequired: boolean
  secondParentName: string | null
}

export function ConsentInitialsPanel({
  clientId,
  consent,
  canEdit,
}: {
  clientId: string
  consent: ConsentShape | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const lines = useMemo(() => parseConsentLines(consent?.lines), [consent?.lines])
  const billingReady = computeConsentBillingReady(lines)

  const sections = useMemo(() => {
    const map = new Map<string, typeof CONSENT_LINE_DEFS[number][]>()
    for (const def of CONSENT_LINE_DEFS) {
      const list = map.get(def.section) ?? []
      list.push(def)
      map.set(def.section, list)
    }
    return [...map.entries()]
  }, [])

  const toggle = (key: ConsentLineKey, on: boolean) => {
    startTransition(async () => {
      await saveConsentInitials(clientId, { [key]: on })
      router.refresh()
    })
  }

  return (
    <div className="mt-2 rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-ink">Consent Form 02 — per-line initials</p>
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
            billingReady
              ? 'bg-[var(--green-bg)] text-[var(--green)]'
              : 'bg-[var(--urgent-bg)] text-[var(--urgent)]'
          )}
        >
          {billingReady ? 'Billing ready (97151 + 97153)' : 'Not billing-ready'}
        </span>
      </div>
      <p className="mt-1 text-xs text-quiet">
        Consent is signed outside the CRM. Email the form, then mark it received
        / upload the returned copy and check the lines the parent initialed.
      </p>
      {consent?.signatureDate && (
        <p className="mt-1 text-xs text-quiet">
          Received {new Date(consent.signatureDate).toLocaleDateString()}
          {consent.expiresAt
            ? ` · expires ${new Date(consent.expiresAt).toLocaleDateString()}`
            : ''}
        </p>
      )}

      <div className="mt-2 space-y-3">
        {sections.map(([section, defs]) => (
          <div key={section}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-quiet">
              {section}
            </p>
            <ul className="mt-1 space-y-1">
              {defs.map((def) => {
                const on = lines[def.key]?.initialed === true
                const billing =
                  def.key === 'cpt_97151' || def.key === 'cpt_97153'
                return (
                  <li key={def.key}>
                    <label className="flex items-center gap-2 text-xs text-ink">
                      <input
                        type="checkbox"
                        disabled={!canEdit || pending}
                        checked={on}
                        onChange={(e) => toggle(def.key, e.target.checked)}
                      />
                      <span>
                        {def.label}
                        {billing && (
                          <span className="ml-1 text-[var(--brand)]">(required to bill)</span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

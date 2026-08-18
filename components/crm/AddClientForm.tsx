'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type {
  ClientReferralSource,
  EthnicityPreference,
  GenderPreference,
} from '@prisma/client'
import { createServiceClient } from '@/lib/crm/actions'
import { NY_BOROUGHS } from '@/lib/client-services/constants'
import { cn } from '@/lib/utils'
import AddressAutocomplete, {
  type StructuredAddress,
} from '@/components/ui/AddressAutocomplete'

const REFERRAL_SOURCES: ClientReferralSource[] = [
  'PHONE',
  'WEBSITE',
  'EMAIL',
  'REFERRAL',
  'SOCIAL_MEDIA',
  'PROVIDER',
  'COMMUNITY',
  'OTHER',
]

const ETHNICITY_OPTIONS: { value: EthnicityPreference; label: string }[] = [
  { value: 'WHITE', label: 'White' },
  { value: 'ASIAN', label: 'Asian' },
  { value: 'BLACK', label: 'Black' },
  { value: 'HISPANIC', label: 'Hispanic' },
  { value: 'SOUTH_ASIAN', label: 'South Asian' },
  { value: 'MIDDLE_EASTERN', label: 'Middle Eastern' },
]

const empty = {
  clientCode: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  addressLine: '',
  city: '',
  borough: '',
  state: 'NY',
  zip: '',
  insuranceProvider: '',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  bcbaName: '',
  referralSource: 'OTHER' as ClientReferralSource,
  preferredRbtGender: '' as '' | GenderPreference,
  preferredRbtEthnicities: [] as EthnicityPreference[],
}

export function AddClientForm({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  if (!open) return null

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const toggleEthnicity = (v: EthnicityPreference) => {
    setForm((f) => ({
      ...f,
      preferredRbtEthnicities: f.preferredRbtEthnicities.includes(v)
        ? f.preferredRbtEthnicities.filter((x) => x !== v)
        : [...f.preferredRbtEthnicities, v],
    }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const res = await createServiceClient({
        clientCode: form.clientCode || undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth || null,
        addressLine: form.addressLine || null,
        city: form.city || null,
        borough: form.borough || null,
        state: form.state || null,
        zip: form.zip || null,
        insuranceProvider: form.insuranceProvider || null,
        parentName: form.parentName || null,
        parentPhone: form.parentPhone || null,
        parentEmail: form.parentEmail || null,
        bcbaName: form.bcbaName || null,
        referralSource: form.referralSource,
        preferredRbtGender: form.preferredRbtGender || null,
        preferredRbtEthnicities: form.preferredRbtEthnicities,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setForm(empty)
      onClose()
      router.push(`/client-services/clients/${res.id}`)
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="add-client-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface shadow-xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <div>
            <h2
              id="add-client-title"
              className="font-display text-lg font-semibold text-ink"
            >
              Add client
            </h2>
            <p className="text-sm text-quiet">
              Internal intake — starts at Inquiry. No parent email is sent.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-quiet hover:bg-line-2 hover:text-ink"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 px-5 py-4">
          {error && (
            <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
              {error}
            </p>
          )}

          <Section title="Identity">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Client code">
                <input
                  value={form.clientCode}
                  onChange={(e) => set('clientCode', e.target.value)}
                  placeholder="Auto CC-###"
                  className={inputCls}
                />
              </Field>
              <Field label="First name *">
                <input
                  required
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Last name *">
                <input
                  required
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Date of birth">
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Insurance">
                <input
                  value={form.insuranceProvider}
                  onChange={(e) => set('insuranceProvider', e.target.value)}
                  placeholder="Aetna, Medicaid…"
                  className={inputCls}
                />
              </Field>
              <Field label="Referral source">
                <select
                  value={form.referralSource}
                  onChange={(e) =>
                    set('referralSource', e.target.value as ClientReferralSource)
                  }
                  className={inputCls}
                >
                  {REFERRAL_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Address">
            <div className="mb-3">
              <AddressAutocomplete
                id="add-client-address"
                label="Search address"
                placeholder="Start typing an address..."
                onAddressSelect={(selected: StructuredAddress) =>
                  setForm((f) => ({
                    ...f,
                    addressLine: selected.addressLine1,
                    city: selected.city,
                    state: selected.state || 'NY',
                    zip: selected.zipCode,
                  }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Street" className="sm:col-span-2">
                <input
                  value={form.addressLine}
                  onChange={(e) => set('addressLine', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="City">
                <input
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Borough">
                <select
                  value={form.borough}
                  onChange={(e) => set('borough', e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {NY_BOROUGHS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="State">
                <input
                  value={form.state}
                  onChange={(e) => set('state', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="ZIP">
                <input
                  value={form.zip}
                  onChange={(e) => set('zip', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          <Section title="Parent / guardian">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name">
                <input
                  value={form.parentName}
                  onChange={(e) => set('parentName', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={form.parentPhone}
                  onChange={(e) => set('parentPhone', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.parentEmail}
                  onChange={(e) => set('parentEmail', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          <Section title="Clinical / staffing prefs">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="BCBA (name)">
                <input
                  value={form.bcbaName}
                  onChange={(e) => set('bcbaName', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Preferred RBT gender">
                <select
                  value={form.preferredRbtGender}
                  onChange={(e) =>
                    set(
                      'preferredRbtGender',
                      e.target.value as '' | GenderPreference
                    )
                  }
                  className={inputCls}
                >
                  <option value="">No preference</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="ANY">Any</option>
                </select>
              </Field>
            </div>
            <fieldset className="mt-3">
              <legend className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                Preferred RBT ethnicities (optional)
              </legend>
              <div className="flex flex-wrap gap-2">
                {ETHNICITY_OPTIONS.map((o) => {
                  const on = form.preferredRbtEthnicities.includes(o.value)
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggleEthnicity(o.value)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-xs font-medium',
                        on
                          ? 'border-brand bg-[color-mix(in_srgb,var(--brand)_12%,white)] text-brand'
                          : 'border-line bg-surface text-quiet hover:text-ink'
                      )}
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </Section>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-line px-3 text-sm text-ink hover:bg-line-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-60"
            >
              {pending ? 'Creating…' : 'Create client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2 font-display text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
        {label}
      </span>
      {children}
    </label>
  )
}

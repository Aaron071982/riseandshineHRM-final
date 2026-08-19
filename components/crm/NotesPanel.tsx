'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type {
  ClientPipelineStatus,
  ClientReferralSource,
  CommChannel,
  EthnicityPreference,
  GenderPreference,
} from '@prisma/client'
import {
  addClientNote,
  logParentContact,
  setPipelineStatus,
  updateClientOverview,
  updateClientPreferences,
} from '@/lib/crm/actions'
import { NY_BOROUGHS } from '@/lib/client-services/constants'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'
import { cn } from '@/lib/utils'

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

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]'

function toDateInputValue(d: string | Date | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

type OverviewClient = {
  id: string
  firstName: string
  lastName: string
  clientCode: string
  dateOfBirth: string | Date | null
  addressLine: string | null
  city: string | null
  borough: string | null
  state: string | null
  zip: string | null
  insuranceProvider: string | null
  insuranceId: string | null
  diagnosis: string | null
  parentName: string | null
  parentPhone: string | null
  parentEmail: string | null
  parentRelationship: string | null
  bcbaName: string | null
  caseCoordinatorName: string | null
  bcbaProfile: { fullName: string; email: string | null } | null
  caseCoordinatorUser: { name: string | null; email: string | null } | null
  referralSource: string | null
  inquiryReceivedAt: string | Date | null
  actualServiceStartDate: string | Date | null
  preferredRbtGender: GenderPreference | null
  preferredRbtEthnicities: EthnicityPreference[]
}

type OverviewForm = {
  dateOfBirth: string
  addressLine: string
  city: string
  borough: string
  state: string
  zip: string
  insuranceProvider: string
  insuranceId: string
  diagnosis: string
  parentName: string
  parentPhone: string
  parentEmail: string
  parentRelationship: string
  bcbaName: string
  caseCoordinatorName: string
  referralSource: ClientReferralSource
  inquiryReceivedAt: string
  actualServiceStartDate: string
}

function buildOverviewForm(client: OverviewClient): OverviewForm {
  return {
    dateOfBirth: toDateInputValue(client.dateOfBirth),
    addressLine: client.addressLine ?? '',
    city: client.city ?? '',
    borough: client.borough ?? '',
    state: client.state ?? 'NY',
    zip: client.zip ?? '',
    insuranceProvider: client.insuranceProvider ?? '',
    insuranceId: client.insuranceId ?? '',
    diagnosis: client.diagnosis ?? '',
    parentName: client.parentName ?? '',
    parentPhone: client.parentPhone ?? '',
    parentEmail: client.parentEmail ?? '',
    parentRelationship: client.parentRelationship ?? '',
    bcbaName: client.bcbaName ?? '',
    caseCoordinatorName: client.caseCoordinatorName ?? '',
    referralSource: (client.referralSource as ClientReferralSource) || 'OTHER',
    inquiryReceivedAt: toDateInputValue(client.inquiryReceivedAt),
    actualServiceStartDate: toDateInputValue(client.actualServiceStartDate),
  }
}

type Note = {
  id: string
  content: string
  createdAt: string | Date
  author: { id: string; name: string | null; email: string | null }
}

export function NotesPanel({
  clientId,
  notes,
  pipelineStatus,
  lastParentContactAt,
  canEdit,
}: {
  clientId: string
  notes: Note[]
  pipelineStatus: ClientPipelineStatus
  lastParentContactAt: string | Date | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [contactNote, setContactNote] = useState('')
  const [channel, setChannel] = useState<CommChannel>('PHONE')
  const [pipeline, setPipeline] = useState(pipelineStatus)
  const [reason, setReason] = useState('')
  const [confirmPipeline, setConfirmPipeline] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  useEffect(() => {
    setPipeline(pipelineStatus)
  }, [pipelineStatus])

  const submitNote = () => {
    if (!content.trim()) return
    startTransition(async () => {
      setError('')
      const res = await addClientNote(clientId, content)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setContent('')
      router.refresh()
    })
  }

  const submitContact = () => {
    startTransition(async () => {
      setError('')
      const res = await logParentContact(clientId, {
        channel,
        note: contactNote,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setContactNote('')
      router.refresh()
    })
  }

  const submitPipeline = () => {
    if (pipeline === 'DISCHARGED' || pipeline === 'LOST') {
      setConfirmPipeline(true)
      return
    }
    runPipelineUpdate()
  }

  const runPipelineUpdate = () => {
    startTransition(async () => {
      setError('')
      const res = await setPipelineStatus(clientId, pipeline, reason)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setReason('')
      setConfirmPipeline(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">Pipeline status</h3>
        <p className="mt-0.5 text-sm text-quiet">
          On hold / discharge does not reset the journey stage.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <select
            value={pipeline}
            disabled={!canEdit || pending}
            onChange={(e) => setPipeline(e.target.value as ClientPipelineStatus)}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
          >
            {(['LIVE', 'ON_HOLD', 'DISCHARGED', 'LOST'] as const).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <input
            value={reason}
            disabled={!canEdit || pending}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            className="h-9 min-w-[12rem] flex-1 rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
          />
          {canEdit && (
            <button
              type="button"
              disabled={pending || pipeline === pipelineStatus}
              onClick={submitPipeline}
              className="h-9 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              Update status
            </button>
          )}
        </div>
      </section>

      <ConfirmDestructiveDialog
        open={confirmPipeline}
        onOpenChange={setConfirmPipeline}
        title={
          pipeline === 'LOST'
            ? 'Mark this family LOST?'
            : 'Discharge this family?'
        }
        description={
          pipeline === 'LOST'
            ? `Set pipeline status to LOST for this family record.\n\nThe journey stage is not reset. This writes an audit log (actor, action, family, time).`
            : `Set pipeline status to DISCHARGED for this family record.\n\nThe journey stage is not reset. This writes an audit log (actor, action, family, time).`
        }
        confirmLabel={pipeline === 'LOST' ? 'Mark LOST' : 'Discharge'}
        pending={pending}
        onConfirm={runPipelineUpdate}
      />

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">Log parent contact</h3>
        <p className="mt-0.5 text-sm text-quiet">
          Last contact:{' '}
          {lastParentContactAt
            ? new Date(lastParentContactAt).toLocaleString()
            : 'Never recorded'}
        </p>
        {canEdit && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as CommChannel)}
              className="h-9 rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            >
              <option value="PHONE">Phone</option>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
            </select>
            <input
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              placeholder="Brief note (optional)"
              className="h-9 min-w-[12rem] flex-1 rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
            <button
              type="button"
              disabled={pending}
              onClick={submitContact}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-line-2"
            >
              Log contact
            </button>
          </div>
        )}
      </section>

      <section>
        <h3 className="font-display text-base font-semibold text-ink">Notes & updates</h3>
        {canEdit && (
          <div className="mt-3 rounded-xl border border-line bg-surface p-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Add an update for the care team…"
              className="w-full resize-y rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                disabled={pending || !content.trim()}
                onClick={submitNote}
                className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
              >
                Add note
              </button>
            </div>
          </div>
        )}

        <ul className="mt-4 space-y-3">
          {notes.length === 0 && (
            <li className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-quiet">
              No notes yet — capture the first update above.
            </li>
          )}
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-quiet">
                <span className="font-medium text-ink">
                  {n.author.name || n.author.email || 'User'}
                </span>
                <time className="tabular-nums">
                  {new Date(n.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{n.content}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function OverviewPanel({
  client,
  canEdit = false,
}: {
  canEdit?: boolean
  client: OverviewClient
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<OverviewForm>(() => buildOverviewForm(client))
  const [overviewError, setOverviewError] = useState('')
  const [gender, setGender] = useState<'' | GenderPreference>(
    client.preferredRbtGender ?? ''
  )
  const [ethnicities, setEthnicities] = useState<EthnicityPreference[]>(
    client.preferredRbtEthnicities ?? []
  )

  useEffect(() => {
    setGender(client.preferredRbtGender ?? '')
    setEthnicities(client.preferredRbtEthnicities ?? [])
    if (!editing) {
      setForm(buildOverviewForm(client))
    }
  }, [client, editing])

  const setField = <K extends keyof OverviewForm>(
    key: K,
    value: OverviewForm[K]
  ) => setForm((f) => ({ ...f, [key]: value }))

  const startEdit = () => {
    setForm(buildOverviewForm(client))
    setOverviewError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setForm(buildOverviewForm(client))
    setOverviewError('')
    setEditing(false)
  }

  const saveOverview = () => {
    startTransition(async () => {
      setOverviewError('')
      const res = await updateClientOverview(client.id, form)
      if (!res.ok) {
        setOverviewError(res.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  const savePrefs = () => {
    startTransition(async () => {
      await updateClientPreferences(client.id, {
        preferredRbtGender: gender || null,
        preferredRbtEthnicities: ethnicities,
      })
      router.refresh()
    })
  }

  const toggleEth = (v: EthnicityPreference) => {
    setEthnicities((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    )
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Client code', value: client.clientCode },
    {
      label: 'Date of birth',
      value: client.dateOfBirth
        ? new Date(client.dateOfBirth).toLocaleDateString()
        : '—',
    },
    {
      label: 'Address',
      value:
        [client.addressLine, client.city, client.borough, client.state, client.zip]
          .filter(Boolean)
          .join(', ') || '—',
    },
    { label: 'Insurance', value: client.insuranceProvider || '—' },
    { label: 'Member ID', value: client.insuranceId || '—' },
    { label: 'Diagnosis', value: client.diagnosis || '—' },
    { label: 'Parent', value: client.parentName || '—' },
    { label: 'Parent phone', value: client.parentPhone || '—' },
    { label: 'Parent email', value: client.parentEmail || '—' },
    { label: 'Relationship', value: client.parentRelationship || '—' },
    {
      label: 'BCBA',
      value: client.bcbaProfile?.fullName || client.bcbaName || '—',
    },
    {
      label: 'Case coordinator',
      value:
        client.caseCoordinatorUser?.name ||
        client.caseCoordinatorUser?.email ||
        client.caseCoordinatorName ||
        '—',
    },
    { label: 'Referral source', value: client.referralSource || '—' },
    {
      label: 'Inquiry received',
      value: client.inquiryReceivedAt
        ? new Date(client.inquiryReceivedAt).toLocaleDateString()
        : '—',
    },
    {
      label: 'Actual start',
      value: client.actualServiceStartDate
        ? new Date(client.actualServiceStartDate).toLocaleDateString()
        : '—',
    },
  ]

  const ethOptions: { value: EthnicityPreference; label: string }[] = [
    { value: 'WHITE', label: 'White' },
    { value: 'ASIAN', label: 'Asian' },
    { value: 'BLACK', label: 'Black' },
    { value: 'HISPANIC', label: 'Hispanic' },
    { value: 'SOUTH_ASIAN', label: 'South Asian' },
    { value: 'MIDDLE_EASTERN', label: 'Middle Eastern' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-ink">
          Client information
        </h3>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="h-8 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-line-2"
          >
            Edit
          </button>
        )}
        {canEdit && editing && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={cancelEdit}
              className="h-8 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-line-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={saveOverview}
              className="h-8 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {overviewError && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {overviewError}
        </p>
      )}

      {editing ? (
        <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Client code
              </span>
              <input value={client.clientCode} disabled className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Date of birth
              </span>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setField('dateOfBirth', e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <div>
            <AddressAutocomplete
              label="Search address"
              defaultValue={form.addressLine}
              onAddressSelect={(selected) => {
                setForm((f) => ({
                  ...f,
                  addressLine: selected.addressLine1,
                  city: selected.city,
                  state: selected.state || 'NY',
                  zip: selected.zipCode,
                }))
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Street
              </span>
              <input
                value={form.addressLine}
                onChange={(e) => setField('addressLine', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                City
              </span>
              <input
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Borough
              </span>
              <select
                value={form.borough}
                onChange={(e) => setField('borough', e.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                {NY_BOROUGHS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                State
              </span>
              <input
                value={form.state}
                onChange={(e) => setField('state', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                ZIP
              </span>
              <input
                value={form.zip}
                onChange={(e) => setField('zip', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Insurance
              </span>
              <input
                value={form.insuranceProvider}
                onChange={(e) => setField('insuranceProvider', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Member ID
              </span>
              <input
                value={form.insuranceId}
                onChange={(e) => setField('insuranceId', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Diagnosis
              </span>
              <input
                value={form.diagnosis}
                onChange={(e) => setField('diagnosis', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Parent name
              </span>
              <input
                value={form.parentName}
                onChange={(e) => setField('parentName', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Parent phone
              </span>
              <input
                value={form.parentPhone}
                onChange={(e) => setField('parentPhone', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Parent email
              </span>
              <input
                type="email"
                value={form.parentEmail}
                onChange={(e) => setField('parentEmail', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Relationship
              </span>
              <input
                value={form.parentRelationship}
                onChange={(e) => setField('parentRelationship', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                BCBA name
              </span>
              <input
                value={form.bcbaName}
                onChange={(e) => setField('bcbaName', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Case coordinator name
              </span>
              <input
                value={form.caseCoordinatorName}
                onChange={(e) => setField('caseCoordinatorName', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Referral source
              </span>
              <select
                value={form.referralSource}
                onChange={(e) =>
                  setField('referralSource', e.target.value as ClientReferralSource)
                }
                className={inputCls}
              >
                {REFERRAL_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Inquiry received
              </span>
              <input
                type="date"
                value={form.inquiryReceivedAt}
                onChange={(e) => setField('inquiryReceivedAt', e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
                Actual start
              </span>
              <input
                type="date"
                value={form.actualServiceStartDate}
                onChange={(e) =>
                  setField('actualServiceStartDate', e.target.value)
                }
                className={inputCls}
              />
            </label>
          </div>
        </div>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className="rounded-xl border border-line bg-surface px-3 py-2.5"
            >
              <dt className="text-[11px] font-medium uppercase tracking-wide text-faint">
                {r.label}
              </dt>
              <dd
                className={cn(
                  'mt-0.5 text-sm text-ink',
                  r.label.includes('phone') && 'tabular-nums'
                )}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-sm font-semibold text-ink">
          RBT preferences
        </h3>
        <p className="mt-0.5 text-xs text-quiet">
          Used by Therapist Search later — empty means no preference.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
              Preferred gender
            </span>
            {canEdit ? (
              <select
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as '' | GenderPreference)
                }
                onBlur={savePrefs}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
              >
                <option value="">No preference</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="ANY">Any</option>
              </select>
            ) : (
              <p className="text-sm text-ink">{gender || '—'}</p>
            )}
          </label>
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
              Preferred ethnicities
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ethOptions.map((o) => {
                const on = ethnicities.includes(o.value)
                return canEdit ? (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      toggleEth(o.value)
                    }}
                    onBlur={savePrefs}
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-xs font-medium',
                      on
                        ? 'border-brand bg-[color-mix(in_srgb,var(--brand)_12%,white)] text-brand'
                        : 'border-line text-quiet'
                    )}
                  >
                    {o.label}
                  </button>
                ) : (
                  on && (
                    <span
                      key={o.value}
                      className="rounded-md border border-line px-2 py-0.5 text-xs"
                    >
                      {o.label}
                    </span>
                  )
                )
              })}
              {!canEdit && ethnicities.length === 0 && (
                <span className="text-sm text-quiet">—</span>
              )}
            </div>
            {canEdit && (
              <button
                type="button"
                disabled={pending}
                onClick={savePrefs}
                className="mt-2 text-xs font-medium text-brand hover:text-brand-2"
              >
                {pending ? 'Saving…' : 'Save preferences'}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

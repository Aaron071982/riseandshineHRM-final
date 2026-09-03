'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CaseCoordinationStatus } from '@prisma/client'
import { CaseCoordinationPrintView } from '@/components/crm/caseCoordination/CaseCoordinationPrintView'
import {
  confirmCaseCoordination,
  patchCaseCoordinationOverrides,
} from '@/lib/crm/caseCoordination/actions'
import type { CaseCoordinationDocumentPayload } from '@/lib/crm/caseCoordination/resolve'
import type { CaseCoordinationOverrides } from '@/lib/crm/caseCoordination/schema'

type RecordRow = {
  id: string
  status: CaseCoordinationStatus
  pdfPath: string | null
  confirmedAt: Date | string | null
  confirmedByUser: { name: string | null; email: string | null } | null
}

type Props = {
  clientId: string
  record: RecordRow | null
  document: CaseCoordinationDocumentPayload | null
  canEdit: boolean
  canConfirm: boolean
}

function toDateInputValue(display: string | null | undefined): string {
  const raw = display?.trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatOverrideStartDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function CaseCoordinationPanel({
  clientId,
  record,
  document,
  canEdit,
  canConfirm,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showOverrides, setShowOverrides] = useState(false)
  const [fieldDraft, setFieldDraft] = useState<CaseCoordinationOverrides['fields']>({})

  const recordId = record?.id
  const isConfirmed = record?.status === 'CONFIRMED'

  const printHref = recordId
    ? `/client-services/clients/${clientId}/case-coordination/${recordId}/print`
    : null

  const savedPdfHref =
    recordId && record?.pdfPath
      ? `/api/client-services/clients/${clientId}/case-coordination/${recordId}/download`
      : null

  const viewPdfHref =
    recordId && record?.pdfPath
      ? `/api/client-services/clients/${clientId}/case-coordination/${recordId}/download?inline=1`
      : null

  const missingHints = useMemo(() => {
    if (!document) return ['Client record could not be loaded']
    const hints: string[] = []
    if (document.bcbaName.includes('Not yet assigned')) hints.push('Assign supervising BCBA')
    if (document.coordinatorName.includes('Not yet assigned')) hints.push('Assign case coordinator')
    if (
      document.behaviorTechnicians.length === 0 ||
      document.behaviorTechnicians.every((r) =>
        r.schedule?.includes('Not yet assigned')
      )
    ) {
      hints.push('Add schedule assignments for behavior technicians')
    }
    return hints
  }, [document])

  const onSaveOverrides = () => {
    if (!recordId) return
    setError(null)
    startTransition(async () => {
      const result = await patchCaseCoordinationOverrides({
        serviceClientId: clientId,
        recordId,
        patch: { fields: fieldDraft },
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
      setShowOverrides(false)
    })
  }

  const onConfirm = () => {
    if (!recordId) return
    if (!window.confirm('Confirm and freeze this case coordination record?')) return
    setError(null)
    startTransition(async () => {
      const result = await confirmCaseCoordination({
        serviceClientId: clientId,
        recordId,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  if (!document || !recordId) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-quiet">
        Loading case coordination…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      {missingHints.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>Before sending:</strong> {missingHints.join(' · ')}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {printHref && (
          <a
            href={printHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-line-2"
          >
            Print preview
          </a>
        )}
        {savedPdfHref && (
          <>
            <a
              href={viewPdfHref ?? savedPdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-2"
            >
              View saved PDF
            </a>
            <a
              href={savedPdfHref}
              className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-line-2"
            >
              Download PDF
            </a>
          </>
        )}
        {!savedPdfHref && printHref && (
          <a
            href={printHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-2"
          >
            Download PDF / Print
          </a>
        )}
        <button
          type="button"
          disabled
          title="Team email send stays disabled until M365 BAA / consent gates are confirmed"
          className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-line px-3 text-sm text-quiet opacity-60"
        >
          Send to team (email dark — pending BAA)
        </button>
        {canConfirm && !isConfirmed && (
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-line-2 disabled:opacity-50"
          >
            Mark confirmed
          </button>
        )}
        {canEdit && !isConfirmed && (
          <button
            type="button"
            onClick={() => setShowOverrides((v) => !v)}
            className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm text-ink hover:bg-line-2"
          >
            {showOverrides ? 'Hide overrides' : 'Edit overrides'}
          </button>
        )}
        {isConfirmed && record?.confirmedAt && (
          <span className="text-sm text-quiet">
            Confirmed
            {record.confirmedByUser?.name
              ? ` by ${record.confirmedByUser.name}`
              : ''}{' '}
            · {new Date(record.confirmedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {showOverrides && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-3 text-sm text-quiet">
            Overrides apply to this document only — they do not change the client record or schedule.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ['clientName', 'Client Name'],
                ['serviceAddress', 'Service Address'],
                ['parentGuardianName', 'Parent/Guardian Name'],
                ['parentEmail', 'Parent Email'],
                ['parentContactNumber', 'Parent Phone'],
                ['bcbaName', 'BCBA Name'],
                ['bcbaContactNumber', 'BCBA Phone'],
                ['bcbaEmail', 'BCBA Email'],
                ['coordinatorName', 'Coordinator Name'],
                ['coordinatorContactNumber', 'Coordinator Phone'],
                ['coordinatorEmail', 'Coordinator Email'],
                ['startDate', 'Start Date'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block text-quiet">{label}</span>
                {key === 'startDate' ? (
                  <input
                    type="date"
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                    defaultValue={toDateInputValue(document.startDate)}
                    onChange={(e) =>
                      setFieldDraft((prev) => ({
                        ...prev,
                        startDate: e.target.value
                          ? formatOverrideStartDate(e.target.value)
                          : '',
                      }))
                    }
                  />
                ) : (
                  <input
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                    defaultValue={document[key] ?? ''}
                    onChange={(e) =>
                      setFieldDraft((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                )}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onSaveOverrides}
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Save overrides
          </button>
        </div>
      )}

      <div className="case-coord-print-root overflow-auto rounded-xl border border-line shadow-sm">
        <CaseCoordinationPrintView
          clientId={clientId}
          recordId={recordId}
          document={document}
          status={record?.status ?? 'DRAFT'}
          embedded
        />
      </div>
    </div>
  )
}

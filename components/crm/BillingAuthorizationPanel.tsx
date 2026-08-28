'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Eye, FileUp, Loader2 } from 'lucide-react'
import type { AuthStatus, AuthType, ClientStage } from '@prisma/client'
import { AuthorizationPanel } from '@/components/crm/AuthorizationPanel'
import {
  ClientDocumentsPanel,
  type ClientDocumentRequirement,
} from '@/components/crm/ClientDocumentsPanel'
import { ConfirmDestructiveDialog } from '@/components/crm/ConfirmDestructiveDialog'
import {
  confirmClientFromBilling,
  createBillingNote,
  recordBenefitsVerification,
  sendAuthorizationToInsurance,
  sendClientBackFromBilling,
} from '@/lib/crm/actions'
import type { StageWarningCode } from '@/lib/crm/stageWarnings'
import { isPaStepAutoSatisfied } from '@/lib/crm/vob'
import { uploadAuthorizationTemplate } from '@/lib/crm/authorizationTemplateUpload.client'
import { STAGE_LABELS } from '@/lib/crm/stages'

type AuthLine = {
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
  submittedDate: string | Date | null
  sentToInsuranceAt: string | Date | null
  sentToInsuranceByUser?: { name: string | null; email: string | null } | null
  lines: AuthLine[]
}

type BillingNote = {
  id: string
  body: string
  createdAt: string | Date
  author: { name: string | null; email: string | null }
}

type AuthTemplate = {
  id: string
  fileName: string
  contentType: string
  sizeBytes: number
  createdAt: string | Date
  uploadedByUser: { name: string | null; email: string | null }
}

export function BillingAuthorizationPanel({
  clientId,
  stage,
  authorizations,
  canEdit,
  billingCanEdit,
  authRequired,
  vobResult,
  documentsAvailable,
  requirements,
  billingNotes,
  authorizationTemplate,
}: {
  clientId: string
  stage: ClientStage
  authorizations: Auth[]
  canEdit: boolean
  billingCanEdit: boolean
  authRequired: boolean
  vobResult: string | null
  documentsAvailable: boolean
  requirements: ClientDocumentRequirement[]
  billingNotes: BillingNote[]
  authorizationTemplate: AuthTemplate | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [vobOutcome, setVobOutcome] = useState<'PA_REQUIRED' | 'NO_PA_REQUIRED'>(
    vobResult === 'NO_PA_REQUIRED' ? 'NO_PA_REQUIRED' : 'PA_REQUIRED'
  )
  const [vobNotes, setVobNotes] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [sendAuthId, setSendAuthId] = useState<string | null>(null)
  const [confirmAdvanceOpen, setConfirmAdvanceOpen] = useState(false)
  const [sendBackOpen, setSendBackOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const paAutoSatisfied = isPaStepAutoSatisfied(authRequired)

  const runStageAction = (
    action: (opts: {
      confirmed: true
      warningOverrides?: StageWarningCode[]
    }) => ReturnType<typeof confirmClientFromBilling>
  ) => {
    startTransition(async () => {
      setError('')
      let warningOverrides: StageWarningCode[] | undefined
      for (;;) {
        const res = await action({ confirmed: true, warningOverrides })
        if (res.ok) {
          router.refresh()
          return
        }
        if (res.needsWarningConfirm && res.warnings?.length) {
          const proceed = window.confirm(
            res.warnings.map((w) => w.message).join('\n\n')
          )
          if (!proceed) return
          warningOverrides = res.warnings.map((w) => w.code)
          continue
        }
        setError(res.error || 'Stage change failed')
        return
      }
    })
  }

  const recordVob = () => {
    startTransition(async () => {
      setError('')
      const res = await recordBenefitsVerification(clientId, {
        vobOutcome,
        notes: vobNotes.trim() || null,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setVobNotes('')
      router.refresh()
    })
  }

  const addNote = () => {
    startTransition(async () => {
      setError('')
      const res = await createBillingNote(clientId, noteBody)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setNoteBody('')
      router.refresh()
    })
  }

  const onTemplatePick = (file: File | null) => {
    if (!file) return
    startTransition(async () => {
      setError('')
      setUploadPct(0)
      try {
        await uploadAuthorizationTemplate(clientId, file, setUploadPct)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploadPct(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    })
  }

  const templateDownloadUrl = (inline: boolean) =>
    `/api/client-services/clients/${clientId}/authorization-template/download${
      inline ? '?inline=1' : ''
    }`

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg bg-[var(--urgent-bg)] px-3 py-2 text-sm text-[var(--urgent)]">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">
          Verification of benefits
        </h3>
        <p className="mt-1 text-sm text-quiet">
          Record VOB outcome server-side. Plan-level PA requirement is derived from
          this — never from payer type.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-quiet">
            Outcome
            <select
              value={vobOutcome}
              disabled={!billingCanEdit || pending}
              onChange={(e) =>
                setVobOutcome(e.target.value as 'PA_REQUIRED' | 'NO_PA_REQUIRED')
              }
              className="mt-1 block h-9 rounded-lg border border-line bg-surface px-2 text-sm"
            >
              <option value="PA_REQUIRED">PA required</option>
              <option value="NO_PA_REQUIRED">No PA required</option>
            </select>
          </label>
          <label className="min-w-[200px] flex-1 text-xs text-quiet">
            Notes (optional, internal)
            <input
              value={vobNotes}
              disabled={!billingCanEdit || pending}
              onChange={(e) => setVobNotes(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm"
              placeholder="VOB call notes…"
            />
          </label>
          {billingCanEdit && (
            <button
              type="button"
              disabled={pending}
              onClick={recordVob}
              className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              Record VOB
            </button>
          )}
        </div>
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-quiet">On file</dt>
            <dd className="font-medium text-ink">{vobResult?.replace(/_/g, ' ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-quiet">PA required</dt>
            <dd className="font-medium text-ink">
              {paAutoSatisfied ? (
                <span className="text-[var(--green)]">Auto-satisfied (no PA)</span>
              ) : authRequired ? (
                'Yes — prior auth required'
              ) : (
                'No'
              )}
            </dd>
          </div>
        </dl>
      </section>

      {billingCanEdit && (
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-4">
          <p className="mr-auto text-sm text-quiet">
            Current stage:{' '}
            <span className="font-medium text-ink">{STAGE_LABELS[stage]}</span>
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => setSendBackOpen(true)}
            className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-line-2 disabled:opacity-50"
          >
            Send back
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmAdvanceOpen(true)}
            className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
          >
            Confirm client / Advance
          </button>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">
          PA authorization template
        </h3>
        <p className="mt-1 text-sm text-quiet">
          Upload the payer PA request template for preview and download. Field parsing
          will be wired when the template format is finalized.
        </p>
        {authorizationTemplate ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <FileUp className="h-4 w-4 text-quiet" aria-hidden />
            <span className="font-medium text-ink">{authorizationTemplate.fileName}</span>
            <span className="text-quiet">
              · {formatSize(authorizationTemplate.sizeBytes)} ·{' '}
              {new Date(authorizationTemplate.createdAt).toLocaleString()} by{' '}
              {authorizationTemplate.uploadedByUser.name ||
                authorizationTemplate.uploadedByUser.email}
            </span>
            <a
              href={templateDownloadUrl(true)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs font-medium hover:bg-line-2"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </a>
            <a
              href={templateDownloadUrl(false)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-xs font-medium hover:bg-line-2"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </div>
        ) : (
          <p className="mt-2 text-sm text-quiet">No template uploaded yet.</p>
        )}
        {billingCanEdit && (
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
              disabled={pending}
              onChange={(e) => onTemplatePick(e.target.files?.[0] ?? null)}
              className="text-sm text-quiet file:mr-2 file:rounded-lg file:border-0 file:bg-line-2 file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {uploadPct != null && (
              <p className="mt-1 flex items-center gap-2 text-xs text-quiet">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading… {uploadPct}%
              </p>
            )}
          </div>
        )}
      </section>

      <AuthorizationPanel
        clientId={clientId}
        authorizations={authorizations}
        canEdit={canEdit}
        authRequired={authRequired}
        paAutoSatisfied={paAutoSatisfied}
        billingCanEdit={billingCanEdit}
        onSendToInsurance={billingCanEdit ? setSendAuthId : undefined}
        sentInsuranceMeta={(auth) =>
          auth.sentToInsuranceAt ? (
            <p className="text-[11px] text-quiet">
              Sent to insurance{' '}
              {new Date(auth.sentToInsuranceAt).toLocaleString()}
              {auth.sentToInsuranceByUser
                ? ` · ${auth.sentToInsuranceByUser.name || auth.sentToInsuranceByUser.email}`
                : ''}
            </p>
          ) : null
        }
      />

      {documentsAvailable ? (
        <section className="space-y-3">
          <div>
            <h3 className="font-display text-base font-semibold text-ink">Documents</h3>
            <p className="text-sm text-quiet">
              Read-only client documents (downloads audited). Available from Benefits
              (VOB) onward for billing.
            </p>
          </div>
          <ClientDocumentsPanel clientId={clientId} requirements={requirements} />
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
          <p className="text-sm text-quiet">
            Client documents unlock when the case reaches Benefits (VOB) stage.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">
          Billing notes
        </h3>
        <p className="mt-1 text-sm text-quiet">
          Internal billing and authorization notes — RBAC-scoped, never emailed.
        </p>
        {billingCanEdit && (
          <div className="mt-3 space-y-2">
            <textarea
              value={noteBody}
              disabled={pending}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={3}
              placeholder="Add an internal billing note…"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            />
            <button
              type="button"
              disabled={pending || !noteBody.trim()}
              onClick={addNote}
              className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
            >
              Add note
            </button>
          </div>
        )}
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {billingNotes.length === 0 && (
            <li className="px-3 py-4 text-sm text-quiet">No billing notes yet.</li>
          )}
          {billingNotes.map((note) => (
            <li key={note.id} className="px-3 py-3">
              <p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p>
              <p className="mt-1 text-[11px] text-quiet">
                {note.author.name || note.author.email} ·{' '}
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDestructiveDialog
        open={!!sendAuthId}
        onOpenChange={(o) => {
          if (!o) setSendAuthId(null)
        }}
        title="Send authorization to insurance?"
        description={`This records an irreversible external PHI transmission event (status update only — no live payer integration yet).\n\nAuthorization: ${
          authorizations.find((a) => a.id === sendAuthId)?.authType ?? '—'
        }`}
        confirmLabel="Send to insurance"
        pending={pending}
        onConfirm={() => {
          if (!sendAuthId) return
          const id = sendAuthId
          startTransition(async () => {
            setError('')
            const res = await sendAuthorizationToInsurance(id, { confirmed: true })
            if (!res.ok) setError(res.error)
            setSendAuthId(null)
            router.refresh()
          })
        }}
      />

      <ConfirmDestructiveDialog
        open={confirmAdvanceOpen}
        onOpenChange={setConfirmAdvanceOpen}
        title="Confirm client and advance?"
        description="Advance this client to the next pipeline stage. Ownership and history will update."
        confirmLabel="Confirm & advance"
        pending={pending}
        onConfirm={() => {
          setConfirmAdvanceOpen(false)
          runStageAction((opts) => confirmClientFromBilling(clientId, opts))
        }}
      />

      <ConfirmDestructiveDialog
        open={sendBackOpen}
        onOpenChange={setSendBackOpen}
        title="Send client back?"
        description="Move this client to the previous pipeline stage and release department claims if applicable."
        confirmLabel="Send back"
        pending={pending}
        onConfirm={() => {
          setSendBackOpen(false)
          startTransition(async () => {
            setError('')
            const res = await sendClientBackFromBilling(clientId, { confirmed: true })
            if (!res.ok) {
              setError(res.error)
              return
            }
            router.refresh()
          })
        }}
      />
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

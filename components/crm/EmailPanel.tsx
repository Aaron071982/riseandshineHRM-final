'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CommTemplate } from '@prisma/client'
import { previewClientEmail, sendClientEmail } from '@/lib/crm/actions'
import { staffTemplateLabel } from '@/lib/crm/emails/templates'
import { EMAIL_LOGO_URL } from '@/lib/crm/emails/templates/shell'
import { cn } from '@/lib/utils'

type Comm = {
  id: string
  template: CommTemplate
  channel: string
  direction: string
  subject: string | null
  body: string | null
  ccRecipients?: string | null
  attachmentsJson?: unknown
  sentAt: string | Date
  status: string | null
  sentByUser: { id: string; name: string | null; email: string | null } | null
}

export type EmailSendContext = {
  allowedTemplates: CommTemplate[]
  canSend: boolean
  blockedReason: string | null
  graphEnabled: boolean
  hasMailbox: boolean
  emailConsentOk?: boolean
}

type AttachedFile = {
  id: string
  fileName: string
  sizeBytes: number
  contentType: string
  storagePath: string
}

type AttachedLink = {
  id: string
  url: string
  label: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function parseAttachmentsJson(raw: unknown): {
  fileNames: string[]
  linkUrls: string[]
} {
  if (!raw || typeof raw !== 'object') {
    if (Array.isArray(raw)) {
      return {
        fileNames: raw
          .map((row) =>
            row && typeof row === 'object' && typeof (row as { fileName?: unknown }).fileName === 'string'
              ? (row as { fileName: string }).fileName
              : null
          )
          .filter((n): n is string => !!n),
        linkUrls: [],
      }
    }
    return { fileNames: [], linkUrls: [] }
  }
  const obj = raw as {
    files?: { fileName?: string }[]
    links?: { url?: string }[]
  }
  return {
    fileNames: (obj.files ?? [])
      .map((f) => f.fileName)
      .filter((n): n is string => !!n),
    linkUrls: (obj.links ?? [])
      .map((l) => l.url)
      .filter((u): u is string => !!u),
  }
}

export type StaffingRbtEmailOption = {
  assignmentId: string
  label: string
  isPrimary: boolean
}

export function EmailPanel({
  clientId,
  parentEmail,
  senderEmail,
  communications,
  emailSend,
  staffingRbts = [],
}: {
  clientId: string
  parentEmail: string | null
  senderEmail: string | null
  communications: Comm[]
  emailSend: EmailSendContext
  staffingRbts?: StaffingRbtEmailOption[]
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [previewPending, startPreview] = useTransition()
  const [uploadPending, setUploadPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const defaultTemplate = emailSend.allowedTemplates[0] ?? 'MANUAL'
  const [template, setTemplate] = useState<CommTemplate>(defaultTemplate)
  const [subject, setSubject] = useState('')
  const [manualBody, setManualBody] = useState('')
  const [cc, setCc] = useState('')
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [links, setLinks] = useState<AttachedLink[]>([])
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [assessmentModality, setAssessmentModality] = useState<
    'IN_HOME' | 'TELEHEALTH' | ''
  >('')
  const [rbtAssignmentId, setRbtAssignmentId] = useState('')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewSubject, setPreviewSubject] = useState('')
  const [consentAcknowledged, setConsentAcknowledged] = useState(false)
  const [ccTouched, setCcTouched] = useState(false)

  const isManual = template === 'MANUAL'
  const isAssessment = template === 'ASSESSMENT_SCHEDULED'
  const isRbtAssigned = template === 'RBT_ASSIGNED'
  const needsConsentWarn = emailSend.emailConsentOk === false

  const localPreviewLogoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/public/email-logo`
      : '/api/public/email-logo'

  const loadPreview = useCallback(() => {
    startPreview(async () => {
      setError('')
      const res = await previewClientEmail(clientId, {
        template,
        subject: isManual ? subject : undefined,
        bodyHtml: isManual && manualBody.trim() ? manualBody : undefined,
        attachments,
        links: links.map(({ url, label }) => ({ url, label: label || undefined })),
        assessmentModality: isAssessment && assessmentModality ? assessmentModality : null,
        rbtAssignmentId:
          isRbtAssigned && rbtAssignmentId ? rbtAssignmentId : null,
      })
      if (!res.ok) {
        setError(res.error)
        setPreviewHtml(null)
        return
      }
      setPreviewSubject(res.subject)
      setPreviewHtml(res.html.replaceAll(EMAIL_LOGO_URL, localPreviewLogoUrl))
      if (!isManual) setSubject(res.subject)
      if (
        template === 'MEET_AND_GREET' &&
        !ccTouched &&
        res.suggestedCc?.length
      ) {
        setCc(res.suggestedCc.join(', '))
      }
    })
  }, [
    clientId,
    template,
    subject,
    manualBody,
    isManual,
    isAssessment,
    assessmentModality,
    isRbtAssigned,
    rbtAssignmentId,
    localPreviewLogoUrl,
    attachments,
    links,
    ccTouched,
  ])

  useEffect(() => {
    if (emailSend.allowedTemplates.includes(template)) {
      loadPreview()
    }
  }, [template, loadPreview, emailSend.allowedTemplates])

  useEffect(() => {
    if (!emailSend.allowedTemplates.includes(template)) {
      setTemplate(emailSend.allowedTemplates[0] ?? 'MANUAL')
    }
  }, [emailSend.allowedTemplates, template])

  useEffect(() => {
    setCcTouched(false)
    if (template !== 'ASSESSMENT_SCHEDULED') {
      setAssessmentModality('')
    }
    if (template !== 'RBT_ASSIGNED') {
      setRbtAssignmentId('')
    }
  }, [template])

  useEffect(() => {
    if (template !== 'RBT_ASSIGNED') return
    if (!staffingRbts.length) {
      setRbtAssignmentId('')
      return
    }
    const primary =
      staffingRbts.find((r) => r.isPrimary)?.assignmentId ??
      staffingRbts[0]!.assignmentId
    setRbtAssignmentId(primary)
  }, [template, staffingRbts])

  useEffect(() => {
    if (template === 'RBT_ASSIGNED' && rbtAssignmentId) {
      loadPreview()
    }
  }, [rbtAssignmentId, template, loadPreview])

  const timeline = useMemo(
    () =>
      communications.filter(
        (c) =>
          c.channel === 'EMAIL' ||
          c.status === 'SENT' ||
          c.status === 'SKIPPED' ||
          c.status === 'FAILED' ||
          c.status === 'RECORDED'
      ),
    [communications]
  )

  const onUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setError('')
    setUploadPending(true)
    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(
          `/api/client-services/clients/${clientId}/email-attachments`,
          { method: 'POST', body: form, credentials: 'include' }
        )
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          attachment?: AttachedFile
        }
        if (!res.ok || !data.attachment) {
          setError(data.error || `Failed to upload ${file.name}`)
          break
        }
        setAttachments((prev) => {
          if (prev.some((a) => a.id === data.attachment!.id)) return prev
          return [...prev, data.attachment!]
        })
      }
    } finally {
      setUploadPending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const addLink = () => {
    const url = linkUrl.trim()
    if (!url) return
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('Links must use http or https')
        return
      }
    } catch {
      setError('Enter a valid URL')
      return
    }
    if (links.length >= 5) {
      setError('At most 5 links allowed')
      return
    }
    setError('')
    setLinks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        url,
        label: linkLabel.trim() || 'Open link',
      },
    ])
    setLinkUrl('')
    setLinkLabel('')
  }

  const onSend = () => {
    if (needsConsentWarn && !consentAcknowledged) {
      setError(
        'Confirm the email-consent warning before sending PHI by email, or cancel.'
      )
      return
    }
    startTransition(async () => {
      setError('')
      setNotice('')
      const res = await sendClientEmail(clientId, {
        template,
        subject: isManual ? subject : undefined,
        bodyHtml: isManual && manualBody.trim() ? manualBody : undefined,
        cc: cc.trim() || undefined,
        attachments,
        links: links.map(({ url, label }) => ({ url, label: label || undefined })),
        assessmentModality: isAssessment && assessmentModality ? assessmentModality : null,
        rbtAssignmentId:
          isRbtAssigned && rbtAssignmentId ? rbtAssignmentId : null,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      if (res.status === 'SKIPPED') {
        setNotice(
          res.reason ??
            'Recorded as SKIPPED — Microsoft Graph sending is not enabled yet.'
        )
      } else if (res.status === 'SENT') {
        setNotice('Email sent successfully.')
      } else {
        setNotice(res.reason ?? `Status: ${res.status}`)
      }
      setAttachments([])
      setLinks([])
      setLinkUrl('')
      setLinkLabel('')
      setConsentAcknowledged(false)
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
      {notice && (
        <p className="rounded-lg bg-[var(--green-bg)] px-3 py-2 text-sm text-[var(--green)]">
          {notice}
        </p>
      )}

      {!emailSend.graphEnabled && (
        <p className="rounded-lg border border-line bg-[var(--sunrise-soft)] px-3 py-2 text-sm text-ink">
          Outbound email is in preview mode. Sends are recorded as{' '}
          <strong>SKIPPED</strong> until M365 admin consent enables Graph (
          <code className="text-xs">GRAPH_EMAIL_ENABLED=true</code>).
        </p>
      )}

      {emailSend.blockedReason && (
        <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-quiet">
          {emailSend.blockedReason}
        </p>
      )}

      {needsConsentWarn && (
        <div className="rounded-lg border border-[var(--amber)] bg-[var(--amber-bg)] px-3 py-3 text-sm text-ink">
          <p className="font-medium text-[var(--espresso)]">
            Email consent not on file
          </p>
          <p className="mt-1 text-quiet">
            Consent Form 02 “Communication — email” is not initialed for this
            family. You can still send, but confirm you’re choosing to email PHI
            without that preference line.
          </p>
          <label className="mt-2 flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={consentAcknowledged}
              onChange={(e) => setConsentAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>I understand and want to proceed with this email.</span>
          </label>
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface p-4">
        <h3 className="font-display text-base font-semibold text-ink">
          Compose email
        </h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-quiet sm:col-span-2">
            Template
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as CommTemplate)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
            >
              {emailSend.allowedTemplates.map((t) => (
                <option key={t} value={t}>
                  {staffTemplateLabel(t)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-quiet">
            From
            <input
              readOnly
              value={senderEmail ?? ''}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-line-2/40 px-2.5 text-sm text-quiet"
            />
          </label>

          <label className="text-xs text-quiet">
            To (parent)
            <input
              readOnly
              value={parentEmail ?? ''}
              placeholder="No parent email on file"
              className="mt-1 h-9 w-full rounded-lg border border-line bg-line-2/40 px-2.5 text-sm text-quiet"
            />
          </label>

          <label className="text-xs text-quiet sm:col-span-2">
            CC (comma-separated)
            <input
              value={cc}
              onChange={(e) => {
                setCcTouched(true)
                setCc(e.target.value)
              }}
              placeholder="colleague@riseandshineaba.com"
              disabled={!emailSend.canSend}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)] disabled:opacity-50"
            />
          </label>

          {isRbtAssigned && (
            <label className="text-xs text-quiet sm:col-span-2">
              RBT (from staffing)
              {staffingRbts.length ? (
                <select
                  value={rbtAssignmentId}
                  onChange={(e) => setRbtAssignmentId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
                >
                  {staffingRbts.map((rbt) => (
                    <option key={rbt.assignmentId} value={rbt.assignmentId}>
                      {rbt.label}
                      {rbt.isPrimary ? ' (primary)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 rounded-lg border border-line bg-line-2/40 px-2.5 py-2 text-sm text-quiet">
                  No active RBT assignments on the Staffing tab. Add one before
                  sending this email.
                </p>
              )}
            </label>
          )}

          {isAssessment && (
            <fieldset className="sm:col-span-2">
              <legend className="text-xs text-quiet">Assessment format</legend>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="assessmentModality"
                    checked={assessmentModality === 'IN_HOME'}
                    onChange={() => setAssessmentModality('IN_HOME')}
                  />
                  In-home
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="assessmentModality"
                    checked={assessmentModality === 'TELEHEALTH'}
                    onChange={() => setAssessmentModality('TELEHEALTH')}
                  />
                  Telehealth
                </label>
              </div>
            </fieldset>
          )}

          {(isManual || previewSubject) && (
            <label className="text-xs text-quiet sm:col-span-2">
              Subject
              <input
                value={isManual ? subject : previewSubject}
                onChange={(e) => setSubject(e.target.value)}
                readOnly={!isManual}
                className={cn(
                  'mt-1 h-9 w-full rounded-lg border border-line px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]',
                  isManual ? 'bg-surface' : 'bg-line-2/40 text-quiet'
                )}
              />
            </label>
          )}

          {isManual && (
            <label className="text-xs text-quiet sm:col-span-2">
              Body (HTML allowed)
              <textarea
                value={manualBody}
                onChange={(e) => setManualBody(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
              />
            </label>
          )}

          <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-faint">
                Files &amp; links
              </span>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt,application/pdf,image/png,image/jpeg"
                  onChange={(e) => onUpload(e.target.files)}
                />
                <button
                  type="button"
                  disabled={!emailSend.canSend || uploadPending || attachments.length >= 5}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
                >
                  {uploadPending ? 'Uploading…' : 'Attach file'}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-quiet">
              Client-tailored files (PHI) upload to private storage and ride the
              Graph mailbox when sending is enabled. Blank forms and external
              signing links can be pasted below. PDF, images, Office docs — up
              to 5 files, 15&nbsp;MB each; up to 5 links.
            </p>
            {attachments.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line bg-line-2/30 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-ink">
                      📎 {a.fileName}{' '}
                      <span className="text-xs text-quiet">
                        ({formatSize(a.sizeBytes)})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                      }
                      className="shrink-0 text-xs text-[var(--urgent)] hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://sign.example.com/..."
                disabled={!emailSend.canSend || links.length >= 5}
                className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)] disabled:opacity-50"
              />
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="Button label (optional)"
                disabled={!emailSend.canSend || links.length >= 5}
                className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)] disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!emailSend.canSend || links.length >= 5 || !linkUrl.trim()}
                onClick={addLink}
                className="h-9 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-line-2 disabled:opacity-50"
              >
                Add link
              </button>
            </div>
            {links.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {links.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line bg-[var(--sunrise-soft)]/40 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-ink">
                      🔗 {l.label}{' '}
                      <span className="text-xs text-quiet">({l.url})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLinks((prev) => prev.filter((x) => x.id !== l.id))
                      }
                      className="shrink-0 text-xs text-[var(--urgent)] hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : attachments.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-quiet">
                No files or links attached
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={previewPending}
            onClick={loadPreview}
            className="h-9 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-ink hover:bg-line-2 disabled:opacity-50"
          >
            {previewPending ? 'Refreshing…' : 'Refresh preview'}
          </button>
          <button
            type="button"
            disabled={
              pending ||
              !emailSend.canSend ||
              !parentEmail ||
              (needsConsentWarn && !consentAcknowledged)
            }
            onClick={onSend}
            className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
          >
            {pending
              ? 'Sending…'
              : emailSend.graphEnabled
                ? 'Send email'
                : 'Record send (Graph off)'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-[#faf6f1]">
        <div className="border-b border-line bg-surface px-4 py-2">
          <h3 className="font-display text-sm font-semibold text-ink">Preview</h3>
          <p className="text-xs text-quiet">
            Branded output parents will receive
            {attachments.length
              ? ` · Files: ${attachments.map((a) => a.fileName).join(', ')}`
              : ''}
            {links.length
              ? ` · Links: ${links.map((l) => l.label).join(', ')}`
              : ''}
            .
          </p>
        </div>
        {previewHtml ? (
          <iframe
            title="Email preview"
            srcDoc={previewHtml}
            className="min-h-[560px] w-full border-0 bg-[#faf6f1]"
            sandbox=""
          />
        ) : (
          <div className="px-4 py-10 text-center text-sm text-quiet">
            Select a template to preview.
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-base font-semibold text-ink">
          Email timeline
        </h3>
        {timeline.length === 0 ? (
          <div className="mt-2 rounded-xl border border-dashed border-line px-4 py-10 text-center">
            <p className="text-sm text-quiet">No emails logged yet.</p>
          </div>
        ) : (
          <ol className="mt-2 space-y-2">
            {timeline.map((c) => {
              const { fileNames, linkUrls } = parseAttachmentsJson(c.attachmentsJson)
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {staffTemplateLabel(c.template)}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <time className="text-xs tabular-nums text-quiet">
                      {new Date(c.sentAt).toLocaleString()}
                    </time>
                  </div>
                  {c.subject && (
                    <p className="mt-1 text-sm text-ink">{c.subject}</p>
                  )}
                  {c.ccRecipients && (
                    <p className="mt-0.5 text-xs text-quiet">
                      CC: {c.ccRecipients}
                    </p>
                  )}
                  {fileNames.length > 0 && (
                    <p className="mt-0.5 text-xs text-quiet">
                      Files: {fileNames.join(', ')}
                    </p>
                  )}
                  {linkUrls.length > 0 && (
                    <p className="mt-0.5 text-xs text-quiet">
                      Links: {linkUrls.join(', ')}
                    </p>
                  )}
                  {c.status === 'SKIPPED' && (
                    <p className="mt-0.5 text-sm text-quiet">
                      Not delivered — Graph sending disabled or no mailbox token.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-faint">
                    {c.sentByUser?.name || c.sentByUser?.email || 'System'}
                  </p>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? 'UNKNOWN'
  const tone =
    label === 'SENT'
      ? 'bg-[var(--green-bg)] text-[var(--green)]'
      : label === 'FAILED'
        ? 'bg-[var(--urgent-bg)] text-[var(--urgent)]'
        : label === 'SKIPPED'
          ? 'bg-[var(--sunrise-soft)] text-[var(--brand)]'
          : 'bg-[var(--blue-bg)] text-[var(--blue)]'
  return (
    <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', tone)}>
      {label}
    </span>
  )
}

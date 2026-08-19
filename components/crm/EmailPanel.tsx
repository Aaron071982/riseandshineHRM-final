'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
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
}

export function EmailPanel({
  clientId,
  parentEmail,
  senderEmail,
  communications,
  emailSend,
}: {
  clientId: string
  parentEmail: string | null
  senderEmail: string | null
  communications: Comm[]
  emailSend: EmailSendContext
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [previewPending, startPreview] = useTransition()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const defaultTemplate = emailSend.allowedTemplates[0] ?? 'MANUAL'
  const [template, setTemplate] = useState<CommTemplate>(defaultTemplate)
  const [subject, setSubject] = useState('')
  const [manualBody, setManualBody] = useState('')
  const [cc, setCc] = useState('')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewSubject, setPreviewSubject] = useState('')

  const isManual = template === 'MANUAL'

  const localPreviewLogoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/new-real-logo.png`
      : '/new-real-logo.png'

  const loadPreview = useCallback(() => {
    startPreview(async () => {
      setError('')
      const res = await previewClientEmail(clientId, {
        template,
        subject: isManual ? subject : undefined,
        bodyHtml: isManual && manualBody.trim() ? manualBody : undefined,
      })
      if (!res.ok) {
        setError(res.error)
        setPreviewHtml(null)
        return
      }
      setPreviewSubject(res.subject)
      // Preview runs in an iframe; use local origin logo for reliable rendering.
      setPreviewHtml(res.html.replaceAll(EMAIL_LOGO_URL, localPreviewLogoUrl))
      if (!isManual) setSubject(res.subject)
    })
  }, [clientId, template, subject, manualBody, isManual, localPreviewLogoUrl])

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

  const timeline = useMemo(
    () =>
      communications.filter(
        (c) => c.channel === 'EMAIL' || c.status === 'SENT' || c.status === 'SKIPPED' || c.status === 'FAILED' || c.status === 'RECORDED'
      ),
    [communications]
  )

  const onSend = () => {
    startTransition(async () => {
      setError('')
      setNotice('')
      const res = await sendClientEmail(clientId, {
        template,
        subject: isManual ? subject : undefined,
        bodyHtml: isManual && manualBody.trim() ? manualBody : undefined,
        cc: cc.trim() || undefined,
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
              onChange={(e) => setCc(e.target.value)}
              placeholder="colleague@riseandshineaba.com"
              disabled={!emailSend.canSend}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)] disabled:opacity-50"
            />
          </label>

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
            disabled={pending || !emailSend.canSend || !parentEmail}
            onClick={onSend}
            className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-2 disabled:opacity-50"
          >
            {pending ? 'Sending…' : emailSend.graphEnabled ? 'Send email' : 'Record send (Graph off)'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="border-b border-line px-4 py-2">
          <h3 className="font-display text-sm font-semibold text-ink">Preview</h3>
          <p className="text-xs text-quiet">Exact branded output parents will receive.</p>
        </div>
        {previewHtml ? (
          <iframe
            title="Email preview"
            srcDoc={previewHtml}
            className="h-[420px] w-full border-0 bg-white"
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
            {timeline.map((c) => (
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
                  <p className="mt-0.5 text-xs text-quiet">CC: {c.ccRecipients}</p>
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
            ))}
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

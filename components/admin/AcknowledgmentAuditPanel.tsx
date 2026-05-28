'use client'

import {
  formatAuditActionLabel,
  getCompletionAuditEvents,
  getCompletionSignatureSummary,
} from '@/lib/acknowledgment-audit-display'
import { formatUserAgentShort } from '@/lib/user-agent-short'
import { LEGAL_BASIS } from '@/lib/signature-certificate'

type CompletionLike = {
  id: string
  acknowledgmentJson?: unknown
  auditTrailJson?: unknown
  signatureText?: string | null
  signatureTimestamp?: Date | string | null
  signatureIpAddress?: string | null
  signatureUserAgent?: string | null
  completedAt?: Date | string | null
  hasSignatureCertificate?: boolean
  documentHash?: string | null
}

export default function AcknowledgmentAuditPanel({
  completion,
  documentTitle,
}: {
  completion: CompletionLike
  documentTitle: string
}) {
  const events = getCompletionAuditEvents(completion)
  const summary = getCompletionSignatureSummary(completion)

  return (
    <div className="mt-3 ml-0 rounded-md border border-gray-200 dark:border-[var(--border-subtle)] bg-gray-50/80 dark:bg-[var(--bg-input)] p-3 space-y-3 text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--text-disabled)]">
        Signature & audit trail — {documentTitle}
      </p>
      <div className="grid gap-1 text-gray-700 dark:text-[var(--text-secondary)]">
        {summary.signerName ? (
          <p>
            <span className="text-gray-500">Signer:</span> {summary.signerName}
          </p>
        ) : null}
        {summary.signedAt ? (
          <p>
            <span className="text-gray-500">Signed:</span>{' '}
            {new Date(summary.signedAt).toLocaleString('en-US', {
              timeZone: 'America/New_York',
              dateStyle: 'medium',
              timeStyle: 'short',
            })}{' '}
            ET
          </p>
        ) : null}
        {summary.ipAddress ? (
          <p>
            <span className="text-gray-500">IP:</span> {summary.ipAddress}
          </p>
        ) : null}
        {summary.userAgent ? (
          <p>
            <span className="text-gray-500">Device:</span> {formatUserAgentShort(summary.userAgent)}
          </p>
        ) : null}
        {summary.documentHash ? (
          <p className="font-mono text-xs break-all">
            <span className="text-gray-500 font-sans">Document hash:</span> {summary.documentHash}
          </p>
        ) : null}
      </div>
      {events.length > 0 ? (
        <div>
          <p className="font-medium text-gray-900 dark:text-[var(--text-primary)] mb-1.5 text-xs">
            Audit trail ({events.length} events)
          </p>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-[var(--text-tertiary)] max-h-40 overflow-y-auto">
            {events.map((ev, i) => (
              <li key={i} className="border-l-2 border-orange-300 pl-2">
                {ev.timestamp
                  ? new Date(ev.timestamp).toLocaleString('en-US', {
                      timeZone: 'America/New_York',
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })
                  : '—'}{' '}
                — {formatAuditActionLabel(ev.action)}
                {ev.ipAddress ? ` · IP ${ev.ipAddress}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-gray-500">No detailed audit events stored for this signature.</p>
      )}
      <p className="text-[10px] text-gray-500 leading-snug">{LEGAL_BASIS}</p>
      {!summary.hasCertificate ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Formal certificate PDF not generated yet — audit data above is from the completion record.
        </p>
      ) : null}
    </div>
  )
}

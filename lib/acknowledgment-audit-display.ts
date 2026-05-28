/** Extract audit events for admin UI from completion storage (no certificate API needed). */

export type AuditDisplayEvent = {
  action: string
  timestamp: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatAuditActionLabel(action: string): string {
  return formatAction(action)
}

export function getCompletionAuditEvents(completion: {
  auditTrailJson?: unknown
  acknowledgmentJson?: unknown
  completedAt?: Date | string | null
  signatureText?: string | null
  signatureTimestamp?: Date | string | null
  signatureIpAddress?: string | null
  signatureUserAgent?: string | null
}): AuditDisplayEvent[] {
  const raw = completion.auditTrailJson as { events?: unknown[]; auditTrail?: unknown[] } | null
  const list = raw?.events ?? raw?.auditTrail
  if (Array.isArray(list) && list.length > 0) {
    return list.map((ev) => {
      const e = ev as Record<string, unknown>
      return {
        action: typeof e.action === 'string' ? e.action : 'event',
        timestamp: typeof e.timestamp === 'string' ? e.timestamp : null,
        ipAddress: typeof e.ipAddress === 'string' ? e.ipAddress : null,
        userAgent: typeof e.userAgent === 'string' ? e.userAgent : null,
      }
    })
  }

  const ack = completion.acknowledgmentJson as { timestamp?: string } | null
  const ts =
    completion.signatureTimestamp != null
      ? String(completion.signatureTimestamp)
      : ack?.timestamp ?? (completion.completedAt != null ? String(completion.completedAt) : null)

  if (ts) {
    return [
      {
        action: 'DOCUMENT_SUBMITTED',
        timestamp: ts,
        ipAddress: completion.signatureIpAddress ?? null,
        userAgent: completion.signatureUserAgent ?? null,
      },
    ]
  }
  return []
}

export type CompletionSignatureSummary = {
  signerName: string | null
  signedAt: string | null
  ipAddress: string | null
  userAgent: string | null
  documentHash: string | null
  hasCertificate: boolean
}

export function getCompletionSignatureSummary(completion: {
  acknowledgmentJson?: unknown
  signatureText?: string | null
  signatureTimestamp?: Date | string | null
  signatureIpAddress?: string | null
  signatureUserAgent?: string | null
  completedAt?: Date | string | null
  hasSignatureCertificate?: boolean
  documentHash?: string | null
}): CompletionSignatureSummary {
  const ack = completion.acknowledgmentJson as { typedName?: string; timestamp?: string } | null
  return {
    signerName: completion.signatureText ?? ack?.typedName ?? null,
    signedAt:
      completion.signatureTimestamp != null
        ? String(completion.signatureTimestamp)
        : ack?.timestamp ?? (completion.completedAt != null ? String(completion.completedAt) : null),
    ipAddress: completion.signatureIpAddress ?? null,
    userAgent: completion.signatureUserAgent ?? null,
    documentHash: completion.documentHash ?? null,
    hasCertificate: Boolean(completion.hasSignatureCertificate),
  }
}

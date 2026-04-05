import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT, SIGNATURE_METHOD, type SignatureMethod } from '@/lib/esign-constants'

export type AuditTrailEvent = Record<string, unknown> & {
  action: string
  timestamp: string
}

const LEGAL_BASIS = 'E-SIGN Act (15 U.S.C. § 7001)'

export async function sha256DocumentPdfSource(doc: {
  pdfData: string | null
  pdfUrl: string | null
}): Promise<{ documentHash: string; integrityNote?: string }> {
  if (doc.pdfData && doc.pdfData.length > 0) {
    try {
      const buf = Buffer.from(doc.pdfData, 'base64')
      const hex = crypto.createHash('sha256').update(buf).digest('hex')
      return { documentHash: `sha256:${hex}` }
    } catch {
      return { documentHash: 'unavailable', integrityNote: 'invalid base64 pdfData' }
    }
  }
  if (doc.pdfUrl) {
    try {
      const c = new AbortController()
      const timer = setTimeout(() => c.abort(), 15000)
      const res = await fetch(doc.pdfUrl, { signal: c.signal, redirect: 'follow' })
      clearTimeout(timer)
      if (!res.ok) {
        return { documentHash: 'unavailable', integrityNote: `HTTP ${res.status}` }
      }
      const ab = await res.arrayBuffer()
      if (ab.byteLength > 25 * 1024 * 1024) {
        return { documentHash: 'unavailable', integrityNote: 'document too large' }
      }
      const hex = crypto.createHash('sha256').update(Buffer.from(ab)).digest('hex')
      return { documentHash: `sha256:${hex}` }
    } catch {
      return { documentHash: 'unavailable', integrityNote: 'fetch error' }
    }
  }
  return { documentHash: 'unavailable', integrityNote: 'no pdf source' }
}

function buildCertificateJson(params: {
  documentTitle: string
  documentSlug: string
  signerFullName: string
  signerEmail: string | null
  signerIpAddress: string | null
  signerUserAgent: string | null
  signatureText: string
  signatureTimestamp: Date
  signatureMethod: SignatureMethod
  consentStatement: string
  consentAgreedAt: string
  documentHash: string
  hashGeneratedAt: string
  auditTrail: AuditTrailEvent[]
  integrityNote?: string
  timezone: string
}): Record<string, unknown> {
  const combined = `${params.documentHash}|${params.signatureText}|${params.signatureTimestamp.toISOString()}`
  const signingPayloadDigest = crypto.createHash('sha256').update(combined, 'utf8').digest('hex')

  return {
    certificateVersion: '1.0',
    documentTitle: params.documentTitle,
    documentSlug: params.documentSlug,
    signer: {
      fullName: params.signerFullName,
      email: params.signerEmail,
      ipAddress: params.signerIpAddress,
      userAgent: params.signerUserAgent,
      location: 'United States',
    },
    signature: {
      method: params.signatureMethod,
      text: params.signatureText,
      timestamp: params.signatureTimestamp.toISOString(),
      timezone: params.timezone,
    },
    consent: {
      statement: params.consentStatement,
      agreedAt: params.consentAgreedAt,
    },
    documentIntegrity: {
      hash: params.documentHash,
      hashAlgorithm: 'SHA-256',
      hashGeneratedAt: params.hashGeneratedAt,
      ...(params.integrityNote ? { note: params.integrityNote } : {}),
      signingPayloadSha256: `sha256:${signingPayloadDigest}`,
    },
    auditTrail: params.auditTrail,
    legalBasis: LEGAL_BASIS,
  }
}

export interface CreateLiveCertificateParams {
  completionId: string
  rbtProfileId: string
  document: { id: string; title: string; slug: string; pdfData: string | null; pdfUrl: string | null }
  rbtProfile: { firstName: string; lastName: string; email: string | null }
  userEmail: string | null
  signatureText: string
  signatureTimestamp: Date
  signerIpAddress: string | null
  signerUserAgent: string | null
  consentStatement: string
  consentAgreedAtIso: string
  auditTrail: AuditTrailEvent[]
  timezone: string
}

export async function createLiveSignatureCertificate(
  tx: Prisma.TransactionClient,
  params: CreateLiveCertificateParams
): Promise<void> {
  const { documentHash, integrityNote } = await sha256DocumentPdfSource({
    pdfData: params.document.pdfData,
    pdfUrl: params.document.pdfUrl,
  })

  const signerFullName = `${params.rbtProfile.firstName} ${params.rbtProfile.lastName}`.trim()
  const signerEmail = params.rbtProfile.email ?? params.userEmail
  const nowIso = new Date().toISOString()

  const certificateJson = buildCertificateJson({
    documentTitle: params.document.title,
    documentSlug: params.document.slug,
    signerFullName,
    signerEmail,
    signerIpAddress: params.signerIpAddress,
    signerUserAgent: params.signerUserAgent,
    signatureText: params.signatureText,
    signatureTimestamp: params.signatureTimestamp,
    signatureMethod: SIGNATURE_METHOD.TYPED_NAME,
    consentStatement: params.consentStatement,
    consentAgreedAt: params.consentAgreedAtIso,
    documentHash,
    hashGeneratedAt: nowIso,
    auditTrail: params.auditTrail,
    integrityNote,
    timezone: params.timezone,
  })

  await tx.signatureCertificate.deleteMany({
    where: { onboardingCompletionId: params.completionId },
  })

  await tx.signatureCertificate.create({
    data: {
      onboardingCompletionId: params.completionId,
      rbtProfileId: params.rbtProfileId,
      documentId: params.document.id,
      documentTitle: params.document.title,
      documentSlug: params.document.slug,
      signerFullName,
      signerEmail,
      signerIpAddress: params.signerIpAddress,
      signerUserAgent: params.signerUserAgent,
      signatureText: params.signatureText,
      signatureTimestamp: params.signatureTimestamp,
      consentStatement: params.consentStatement,
      documentHash,
      certificateGeneratedAt: new Date(),
      certificateJson: certificateJson as Prisma.InputJsonValue,
    },
  })
}

export interface CreatePreComplianceCertificateParams {
  completion: {
    id: string
    rbtProfileId: string
    documentId: string
    completedAt: Date | null
    acknowledgmentJson: unknown
  }
  document: { id: string; title: string; slug: string; pdfData: string | null; pdfUrl: string | null }
  rbtProfile: { firstName: string; lastName: string; email: string | null }
  userEmail: string | null
  upgradeDateIso: string
}

export async function createPreComplianceSignatureCertificate(
  tx: Prisma.TransactionClient,
  params: CreatePreComplianceCertificateParams
): Promise<void> {
  const ack = params.completion.acknowledgmentJson as { typedName?: string; ip?: string; userAgent?: string } | null
  const typed = typeof ack?.typedName === 'string' ? ack.typedName.trim() : ''
  const signerFullName =
    typed ||
    `${params.rbtProfile.firstName} ${params.rbtProfile.lastName}`.trim() ||
    'Unknown signer'
  const signerEmail = params.rbtProfile.email ?? params.userEmail
  const signatureTimestamp = params.completion.completedAt ?? new Date()

  const { documentHash, integrityNote } = await sha256DocumentPdfSource({
    pdfData: params.document.pdfData,
    pdfUrl: params.document.pdfUrl,
  })

  const disclaimer = `Document completed prior to E-SIGN compliance upgrade on ${params.upgradeDateIso.slice(0, 10)}. Completion timestamp from system records. IP address not available for pre-compliance completions.`

  const certificateJson: Record<string, unknown> = {
    certificateVersion: '1.0',
    preCompliance: true,
    disclaimer,
    documentTitle: params.document.title,
    documentSlug: params.document.slug,
    signer: {
      fullName: signerFullName,
      email: signerEmail,
      ipAddress: typeof ack?.ip === 'string' ? ack.ip : null,
      userAgent: typeof ack?.userAgent === 'string' ? ack.userAgent : null,
      location: 'United States',
    },
    signature: {
      method: SIGNATURE_METHOD.PRE_COMPLIANCE,
      text: typed || null,
      timestamp: signatureTimestamp.toISOString(),
      timezone: 'America/New_York',
    },
    documentIntegrity: {
      hash: documentHash,
      hashAlgorithm: 'SHA-256',
      ...(integrityNote ? { note: integrityNote } : {}),
    },
    auditTrail: [] as AuditTrailEvent[],
    legalBasis: LEGAL_BASIS,
  }

  await tx.signatureCertificate.create({
    data: {
      onboardingCompletionId: params.completion.id,
      rbtProfileId: params.completion.rbtProfileId,
      documentId: params.document.id,
      documentTitle: params.document.title,
      documentSlug: params.document.slug,
      signerFullName,
      signerEmail,
      signerIpAddress: typeof ack?.ip === 'string' ? ack.ip : null,
      signerUserAgent: typeof ack?.userAgent === 'string' ? ack.userAgent : null,
      signatureText: typed || null,
      signatureTimestamp,
      consentStatement: PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT,
      documentHash,
      certificateGeneratedAt: new Date(),
      certificateJson: certificateJson as Prisma.InputJsonValue,
    },
  })
}

export { LEGAL_BASIS, PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT }

import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import {
  PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT,
  FILLABLE_PDF_SUBMISSION_CONSENT_STATEMENT,
  SIGNATURE_METHOD,
  type SignatureMethod,
} from '@/lib/esign-constants'

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

/** SHA-256 of the completed (filled/signed) PDF bytes — used for fillable PDF submissions. */
export function sha256PdfBuffer(
  buf: Buffer | Uint8Array
): { documentHash: string; integrityNote?: string } {
  const hex = crypto.createHash('sha256').update(buf).digest('hex')
  return { documentHash: `sha256:${hex}` }
}

/**
 * Hash a completed fillable PDF from base64 in DB or Supabase storage path.
 */
export async function hashFillableCompletionPdf(params: {
  signedPdfData: string | null | undefined
  signedPdfUrl: string | null | undefined
  storageBucket: string | null | undefined
}): Promise<{ documentHash: string; integrityNote?: string }> {
  const b64 = params.signedPdfData?.trim()
  if (b64 && b64.length > 0) {
    try {
      const buf = Buffer.from(b64, 'base64')
      if (buf.length === 0) return { documentHash: 'unavailable', integrityNote: 'empty base64' }
      return sha256PdfBuffer(buf)
    } catch {
      return { documentHash: 'unavailable', integrityNote: 'invalid base64 pdfData' }
    }
  }
  const path = params.signedPdfUrl?.trim()
  const bucket = params.storageBucket?.trim()
  if (path && bucket) {
    const { supabaseAdmin } = await import('@/lib/supabase')
    if (!supabaseAdmin) return { documentHash: 'unavailable', integrityNote: 'supabase not configured' }
    try {
      const { data: blob, error } = await supabaseAdmin.storage.from(bucket).download(path)
      if (error || !blob) {
        return { documentHash: 'unavailable', integrityNote: error?.message || 'download failed' }
      }
      const ab = await blob.arrayBuffer()
      if (ab.byteLength > 25 * 1024 * 1024) {
        return { documentHash: 'unavailable', integrityNote: 'document too large' }
      }
      return sha256PdfBuffer(Buffer.from(ab))
    } catch {
      return { documentHash: 'unavailable', integrityNote: 'storage download error' }
    }
  }
  return { documentHash: 'unavailable', integrityNote: 'no completed PDF on file' }
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

export interface CreateFillablePdfCertificateParams {
  completionId: string
  rbtProfileId: string
  document: { id: string; title: string; slug: string }
  rbtProfile: { firstName: string; lastName: string; email: string | null }
  userEmail: string | null
  pdfBuffer: Buffer
  signatureTimestamp: Date
  signerIpAddress: string | null
  signerUserAgent: string | null
  auditTrail: AuditTrailEvent[]
  timezone: string
}

/** Certificate for a completed fillable PDF (uploaded bytes hashed; not the blank template). */
export async function createFillablePdfSignatureCertificate(
  tx: Prisma.TransactionClient,
  params: CreateFillablePdfCertificateParams
): Promise<void> {
  const { documentHash, integrityNote } = sha256PdfBuffer(params.pdfBuffer)
  const signerFullName = `${params.rbtProfile.firstName} ${params.rbtProfile.lastName}`.trim()
  const signerEmail = params.rbtProfile.email ?? params.userEmail
  const signatureText = signerFullName || 'Completed PDF submission'
  const nowIso = new Date().toISOString()
  const consentStatement = FILLABLE_PDF_SUBMISSION_CONSENT_STATEMENT

  const certificateJson = buildCertificateJson({
    documentTitle: params.document.title,
    documentSlug: params.document.slug,
    signerFullName,
    signerEmail,
    signerIpAddress: params.signerIpAddress,
    signerUserAgent: params.signerUserAgent,
    signatureText,
    signatureTimestamp: params.signatureTimestamp,
    signatureMethod: SIGNATURE_METHOD.UPLOADED,
    consentStatement,
    consentAgreedAt: params.signatureTimestamp.toISOString(),
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
      signatureText,
      signatureTimestamp: params.signatureTimestamp,
      consentStatement,
      documentHash,
      certificateGeneratedAt: new Date(),
      certificateJson: certificateJson as Prisma.InputJsonValue,
    },
  })
}

export interface CreateRetroactiveFillablePdfCertificateParams {
  completion: {
    id: string
    rbtProfileId: string
    documentId: string
    completedAt: Date | null
    signedPdfData: string | null
    signedPdfUrl: string | null
    storageBucket: string | null
    signatureText: string | null
    signatureTimestamp: Date | null
    signatureIpAddress: string | null
    signatureUserAgent: string | null
  }
  document: { id: string; title: string; slug: string }
  rbtProfile: { firstName: string; lastName: string; email: string | null }
  userEmail: string | null
  upgradeDateIso: string
}

/** Backfill certificate from stored completed PDF when no live signing metadata exists. */
export async function createRetroactiveFillablePdfSignatureCertificate(
  tx: Prisma.TransactionClient,
  params: CreateRetroactiveFillablePdfCertificateParams
): Promise<void> {
  const { documentHash, integrityNote } = await hashFillableCompletionPdf({
    signedPdfData: params.completion.signedPdfData,
    signedPdfUrl: params.completion.signedPdfUrl,
    storageBucket: params.completion.storageBucket,
  })

  const profileName = `${params.rbtProfile.firstName} ${params.rbtProfile.lastName}`.trim()
  const typed = params.completion.signatureText?.trim()
  const signerFullName = typed || profileName || 'Unknown signer'
  const signerEmail = params.rbtProfile.email ?? params.userEmail
  const signatureTimestamp = params.completion.signatureTimestamp ?? params.completion.completedAt ?? new Date()
  const consentStatement = FILLABLE_PDF_SUBMISSION_CONSENT_STATEMENT
  const disclaimer = `Certificate generated from stored completed PDF on ${params.upgradeDateIso.slice(0, 10)}. Some submission metadata may be unavailable for historical records.`

  const certificateJson: Record<string, unknown> = {
    certificateVersion: '1.0',
    retroactiveFromStoredPdf: true,
    disclaimer,
    documentTitle: params.document.title,
    documentSlug: params.document.slug,
    signer: {
      fullName: signerFullName,
      email: signerEmail,
      ipAddress: params.completion.signatureIpAddress,
      userAgent: params.completion.signatureUserAgent,
      location: 'United States',
    },
    signature: {
      method: SIGNATURE_METHOD.UPLOADED,
      text: signerFullName,
      timestamp: signatureTimestamp.toISOString(),
      timezone: 'America/New_York',
    },
    consent: {
      statement: consentStatement,
      agreedAt: signatureTimestamp.toISOString(),
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
      signerIpAddress: params.completion.signatureIpAddress,
      signerUserAgent: params.completion.signatureUserAgent,
      signatureText: signerFullName,
      signatureTimestamp,
      consentStatement,
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

export { LEGAL_BASIS, PER_DOCUMENT_SIGNATURE_CONSENT_STATEMENT, FILLABLE_PDF_SUBMISSION_CONSENT_STATEMENT }

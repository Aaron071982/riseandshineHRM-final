import type { Prisma } from '@prisma/client'
import { SIGNATURE_METHOD } from '@/lib/esign-constants'
import { isMissingColumnError, isMissingTableError } from '@/lib/db/prisma-errors'
import {
  createLiveSignatureCertificate,
  type CreateLiveCertificateParams,
} from '@/lib/signature-certificate'

export type AcknowledgmentCompletionPayload = {
  rbtProfileId: string
  documentId: string
  signedAt: Date
  acknowledgmentJson: object
  trimmedName: string
  serverIp: string
  serverUa: string
  auditTrailJson: object
}

const COMPLETION_RESULT_SELECT = {
  id: true,
  rbtProfileId: true,
  documentId: true,
  status: true,
  completedAt: true,
  acknowledgmentJson: true,
} as const

export async function upsertAcknowledgmentCompletion(
  tx: Prisma.TransactionClient,
  payload: AcknowledgmentCompletionPayload
) {
  const where = {
    rbtProfileId_documentId: {
      rbtProfileId: payload.rbtProfileId,
      documentId: payload.documentId,
    },
  }

  const minimal = {
    status: 'COMPLETED' as const,
    completedAt: payload.signedAt,
    acknowledgmentJson: payload.acknowledgmentJson as Prisma.InputJsonValue,
  }

  const extended = {
    ...minimal,
    signatureText: payload.trimmedName,
    signatureTimestamp: payload.signedAt,
    signatureIpAddress: payload.serverIp,
    signatureUserAgent: payload.serverUa,
    signatureConsentGiven: true,
    signatureMethod: SIGNATURE_METHOD.TYPED_NAME,
    auditTrailJson: payload.auditTrailJson as Prisma.InputJsonValue,
  }

  try {
    return await tx.onboardingCompletion.upsert({
      where,
      update: extended,
      create: {
        rbtProfileId: payload.rbtProfileId,
        documentId: payload.documentId,
        ...extended,
      },
      select: COMPLETION_RESULT_SELECT,
    })
  } catch (err) {
    if (!isMissingColumnError(err)) throw err
    console.warn(
      '[acknowledge] signature audit columns missing — saving completion with acknowledgmentJson only'
    )
    return await tx.onboardingCompletion.upsert({
      where,
      update: minimal,
      create: {
        rbtProfileId: payload.rbtProfileId,
        documentId: payload.documentId,
        ...minimal,
      },
      select: COMPLETION_RESULT_SELECT,
    })
  }
}

export async function upsertEsignConsentProfile(
  tx: Prisma.TransactionClient,
  userId: string,
  signedAt: Date
): Promise<void> {
  try {
    await tx.userProfile.upsert({
      where: { userId },
      create: { userId, eSignConsentGiven: true, eSignConsentTimestamp: signedAt },
      update: { eSignConsentGiven: true, eSignConsentTimestamp: signedAt },
    })
    return
  } catch (err) {
    if (!isMissingColumnError(err)) throw err
  }

  try {
    await tx.userProfile.upsert({
      where: { userId },
      create: { userId, eSignConsentGiven: true },
      update: { eSignConsentGiven: true },
    })
  } catch (err) {
    if (!isMissingColumnError(err)) throw err
    console.warn('[acknowledge] user_profiles e-sign columns missing — skipping profile upsert')
  }
}

export async function tryCreateAcknowledgmentCertificate(
  tx: Prisma.TransactionClient,
  params: CreateLiveCertificateParams & {
    documentHash?: string
    integrityNote?: string
  }
): Promise<{ created: boolean }> {
  try {
    await createLiveSignatureCertificate(tx, params)
    return { created: true }
  } catch (err) {
    if (isMissingTableError(err, 'signature_certificates') || isMissingColumnError(err)) {
      console.error(
        '[acknowledge] signature certificate skipped — run prisma/scripts/esign-compliance-migration.sql',
        err
      )
      return { created: false }
    }
    throw err
  }
}

export async function trySetSupervisionContractPending(
  tx: Prisma.TransactionClient,
  rbtProfileId: string
): Promise<void> {
  try {
    await tx.rBTProfile.update({
      where: { id: rbtProfileId },
      data: { supervisionContractStatus: 'PENDING_BCBA' },
    })
  } catch (err) {
    if (!isMissingColumnError(err)) throw err
    console.warn('[acknowledge] supervisionContractStatus column missing — skipping status update')
  }
}

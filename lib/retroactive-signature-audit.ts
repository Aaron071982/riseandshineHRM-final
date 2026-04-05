import { prisma } from './prisma'
import {
  createPreComplianceSignatureCertificate,
  createRetroactiveFillablePdfSignatureCertificate,
} from './signature-certificate'

export type RetroactiveAuditResult =
  | {
      dryRun: true
      scanned: number
      wouldCreate: number
      acknowledgments: { scanned: number; wouldCreate: number }
      fillablePdfs: { scanned: number; wouldCreate: number }
    }
  | {
      dryRun: false
      scanned: number
      created: number
      acknowledgments: { scanned: number; created: number }
      fillablePdfs: { scanned: number; created: number }
    }

export type RunRetroactiveSignatureAuditOptions = {
  /** If true, only count completions that would get a certificate; no database writes. */
  dryRun?: boolean
}

function hasStoredCompletedPdf(c: {
  signedPdfUrl: string | null
  signedPdfData: string | null
}): boolean {
  const url = c.signedPdfUrl?.trim()
  const data = c.signedPdfData?.trim()
  return !!(url && url.length > 0) || !!(data && data.length > 0)
}

async function runAcknowledgmentRetroactiveAudit(
  dryRun: boolean
): Promise<{ scanned: number; wouldCreate: number } | { scanned: number; created: number }> {
  const rows = await prisma.onboardingCompletion.findMany({
    where: {
      status: 'COMPLETED',
      document: { type: 'ACKNOWLEDGMENT' },
    },
    include: {
      document: true,
      rbtProfile: true,
      signatureCertificate: true,
    },
  })
  const candidates = rows.filter((r) => !r.signatureCertificate)

  if (dryRun) {
    return {
      scanned: candidates.length,
      wouldCreate: candidates.length,
    }
  }

  const upgradeDateIso = new Date().toISOString()
  let created = 0

  for (const completion of candidates) {
    const user = await prisma.user.findUnique({
      where: { id: completion.rbtProfile.userId },
      select: { email: true },
    })

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.signatureCertificate.findUnique({
          where: { onboardingCompletionId: completion.id },
        })
        if (existing) return

        await createPreComplianceSignatureCertificate(tx, {
          completion: {
            id: completion.id,
            rbtProfileId: completion.rbtProfileId,
            documentId: completion.documentId,
            completedAt: completion.completedAt,
            acknowledgmentJson: completion.acknowledgmentJson,
          },
          document: {
            id: completion.document.id,
            title: completion.document.title,
            slug: completion.document.slug,
            pdfData: completion.document.pdfData,
            pdfUrl: completion.document.pdfUrl,
          },
          rbtProfile: {
            firstName: completion.rbtProfile.firstName,
            lastName: completion.rbtProfile.lastName,
            email: completion.rbtProfile.email,
          },
          userEmail: user?.email ?? null,
          upgradeDateIso,
        })
      })
      created += 1
    } catch (e) {
      console.error('[retroactive-signature-audit] skip acknowledgment completion', completion.id, e)
    }
  }

  return { created, scanned: candidates.length }
}

async function runFillablePdfRetroactiveAudit(
  dryRun: boolean
): Promise<{ scanned: number; wouldCreate: number } | { scanned: number; created: number }> {
  const rows = await prisma.onboardingCompletion.findMany({
    where: {
      status: 'COMPLETED',
      document: { type: 'FILLABLE_PDF' },
    },
    include: {
      document: true,
      rbtProfile: true,
      signatureCertificate: true,
    },
  })
  const candidates = rows.filter((r) => !r.signatureCertificate && hasStoredCompletedPdf(r))

  if (dryRun) {
    return {
      scanned: candidates.length,
      wouldCreate: candidates.length,
    }
  }

  const upgradeDateIso = new Date().toISOString()
  let created = 0

  for (const completion of candidates) {
    const user = await prisma.user.findUnique({
      where: { id: completion.rbtProfile.userId },
      select: { email: true },
    })

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.signatureCertificate.findUnique({
          where: { onboardingCompletionId: completion.id },
        })
        if (existing) return

        await createRetroactiveFillablePdfSignatureCertificate(tx, {
          completion: {
            id: completion.id,
            rbtProfileId: completion.rbtProfileId,
            documentId: completion.documentId,
            completedAt: completion.completedAt,
            signedPdfData: completion.signedPdfData,
            signedPdfUrl: completion.signedPdfUrl,
            storageBucket: completion.storageBucket,
            signatureText: completion.signatureText,
            signatureTimestamp: completion.signatureTimestamp,
            signatureIpAddress: completion.signatureIpAddress,
            signatureUserAgent: completion.signatureUserAgent,
          },
          document: {
            id: completion.document.id,
            title: completion.document.title,
            slug: completion.document.slug,
          },
          rbtProfile: {
            firstName: completion.rbtProfile.firstName,
            lastName: completion.rbtProfile.lastName,
            email: completion.rbtProfile.email,
          },
          userEmail: user?.email ?? null,
          upgradeDateIso,
        })
      })
      created += 1
    } catch (e) {
      console.error('[retroactive-signature-audit] skip fillable completion', completion.id, e)
    }
  }

  return { created, scanned: candidates.length }
}

/**
 * Same behavior as POST /api/admin/onboarding/audit-existing-signatures (optional dryRun).
 * Runs acknowledgment backfill and fillable-PDF backfill.
 */
export async function runRetroactiveSignatureAudit(
  options: RunRetroactiveSignatureAuditOptions = {}
): Promise<RetroactiveAuditResult> {
  const dryRun = options.dryRun === true

  const ack = await runAcknowledgmentRetroactiveAudit(dryRun)
  const fill = await runFillablePdfRetroactiveAudit(dryRun)

  if (dryRun) {
    const a = ack as { scanned: number; wouldCreate: number }
    const f = fill as { scanned: number; wouldCreate: number }
    return {
      dryRun: true,
      acknowledgments: { scanned: a.scanned, wouldCreate: a.wouldCreate },
      fillablePdfs: { scanned: f.scanned, wouldCreate: f.wouldCreate },
      scanned: a.scanned + f.scanned,
      wouldCreate: a.wouldCreate + f.wouldCreate,
    }
  }

  const a = ack as { scanned: number; created: number }
  const f = fill as { scanned: number; created: number }
  return {
    dryRun: false,
    acknowledgments: { scanned: a.scanned, created: a.created },
    fillablePdfs: { scanned: f.scanned, created: f.created },
    scanned: a.scanned + f.scanned,
    created: a.created + f.created,
  }
}

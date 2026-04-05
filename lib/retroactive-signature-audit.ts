import { prisma } from './prisma'
import { createPreComplianceSignatureCertificate } from './signature-certificate'

export type RetroactiveAuditResult =
  | { dryRun: true; scanned: number; wouldCreate: number }
  | { dryRun: false; scanned: number; created: number }

export type RunRetroactiveSignatureAuditOptions = {
  /** If true, only count completions that would get a certificate; no database writes. */
  dryRun?: boolean
}

/**
 * Same behavior as POST /api/admin/onboarding/audit-existing-signatures (optional dryRun).
 */
export async function runRetroactiveSignatureAudit(
  options: RunRetroactiveSignatureAuditOptions = {}
): Promise<RetroactiveAuditResult> {
  const dryRun = options.dryRun === true

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
      dryRun: true,
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
      console.error('[retroactive-signature-audit] skip completion', completion.id, e)
    }
  }

  return { dryRun: false, created, scanned: candidates.length }
}

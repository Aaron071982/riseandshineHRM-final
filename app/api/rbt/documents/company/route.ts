import { NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isCompanyDocTestEmail } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRbtSession()
  if (auth.response) return auth.response
  const rbtProfileId = auth.user.rbtProfileId!
  const userEmail = auth.user.email?.trim().toLowerCase() ?? null

  const profile = await prisma.rBTProfile.findUnique({
    where: { id: rbtProfileId },
    select: { email: true, user: { select: { email: true } } },
  })
  const isTestAccount = isCompanyDocTestEmail(userEmail) || isCompanyDocTestEmail(profile?.email) || isCompanyDocTestEmail(profile?.user?.email)

  const rows = await prisma.companyDocumentRecipient.findMany({
    where: {
      rbtProfileId,
      companyDocument: {
        isActive: true,
        ...(isTestAccount ? {} : { isTest: false }),
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      companyDocument: {
        select: {
          id: true,
          title: true,
          description: true,
          fileType: true,
          documentType: true,
          isTest: true,
          createdAt: true,
        },
      },
    },
  })

  // Defense: never return another RBT's rows; hide test docs from non-test accounts
  const assignments = rows
    .filter((r) => r.rbtProfileId === rbtProfileId)
    .filter((r) => (isTestAccount ? true : !r.companyDocument.isTest))
    .map((r) => ({
      recipientId: r.id,
      documentId: r.companyDocument.id,
      title: r.companyDocument.title,
      description: r.companyDocument.description,
      fileType: r.companyDocument.fileType,
      documentType: r.companyDocument.documentType,
      isTest: r.companyDocument.isTest,
      status: r.status,
      signedName: r.signedName,
      signedAt: r.signedAt?.toISOString() ?? null,
      viewedAt: r.viewedAt?.toISOString() ?? null,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      createdAt: r.companyDocument.createdAt.toISOString(),
      previewUrl: `/api/rbt/documents/company-dist/${r.companyDocument.id}/file`,
    }))

  return NextResponse.json({ assignments })
}

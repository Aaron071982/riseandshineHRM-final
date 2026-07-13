import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailCompanyDocRecipients } from '@/lib/company-documents/distribute'

export const dynamic = 'force-dynamic'

/** Resend email to recipients who have not completed their action. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  const doc = await prisma.companyDocument.findUnique({
    where: { id },
    include: {
      recipients: {
        where: {
          status: { in: ['PENDING', 'VIEWED'] },
        },
        include: {
          rbtProfile: {
            select: {
              id: true,
              firstName: true,
              email: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const needsAction =
    doc.documentType === 'VIEW_ONLY'
      ? doc.recipients.filter((r) => r.status === 'PENDING')
      : doc.recipients.filter((r) => r.status === 'PENDING' || r.status === 'VIEWED')

  const list = needsAction
    .map((r) => {
      const email = (r.rbtProfile.email || r.rbtProfile.user?.email || '').trim()
      if (!email) return null
      return {
        id: r.rbtProfile.id,
        firstName: r.rbtProfile.firstName,
        email,
      }
    })
    .filter((r): r is { id: string; firstName: string; email: string } => !!r)

  if (list.length === 0) {
    return NextResponse.json({ emailed: 0, message: 'No pending recipients to notify' })
  }

  const emailed = await emailCompanyDocRecipients({
    recipients: list,
    title: doc.title,
    documentType: doc.documentType,
    isTest: doc.isTest,
    companyDocumentId: doc.id,
  })

  return NextResponse.json({ emailed, recipientCount: list.length })
}

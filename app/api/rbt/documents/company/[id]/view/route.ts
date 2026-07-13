import { NextRequest, NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isCompanyDocTestEmail } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRbtSession()
  if (auth.response) return auth.response
  const rbtProfileId = auth.user.rbtProfileId!
  const { id } = await params

  const row = await prisma.companyDocumentRecipient.findUnique({
    where: { companyDocumentId_rbtProfileId: { companyDocumentId: id, rbtProfileId } },
    include: { companyDocument: true },
  })
  if (!row || row.rbtProfileId !== rbtProfileId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (row.companyDocument.isTest && !isCompanyDocTestEmail(auth.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const nextStatus =
    row.status === 'SIGNED' || row.status === 'SUBMITTED'
      ? row.status
      : row.companyDocument.documentType === 'VIEW_ONLY'
        ? 'VIEWED'
        : row.status === 'PENDING'
          ? 'VIEWED'
          : row.status

  const updated = await prisma.companyDocumentRecipient.update({
    where: { id: row.id },
    data: {
      viewedAt: row.viewedAt ?? now,
      status: nextStatus,
    },
  })

  return NextResponse.json({
    recipient: {
      id: updated.id,
      status: updated.status,
      viewedAt: updated.viewedAt?.toISOString() ?? null,
    },
  })
}

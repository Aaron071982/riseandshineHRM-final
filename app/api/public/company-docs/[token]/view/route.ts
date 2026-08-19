import { NextRequest, NextResponse } from 'next/server'
import { resolveCompanyDocAccessToken } from '@/lib/company-documents/accessToken'
import { assertCompanyDocPublicRateLimit } from '@/lib/company-documents/publicRateLimit'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

/** Mark document viewed via magic link. */
export async function POST(request: NextRequest, context: Ctx) {
  const rateLimited = await assertCompanyDocPublicRateLimit(request, 'view')
  if (rateLimited) return rateLimited

  const { token } = await context.params
  const row = await resolveCompanyDocAccessToken(token)
  if (!row) {
    return NextResponse.json({ error: 'Link expired or invalid' }, { status: 404 })
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

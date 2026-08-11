import { NextRequest, NextResponse } from 'next/server'
import { resolveCompanyDocAccessToken } from '@/lib/company-documents/accessToken'
import {
  companyDocFileResponse,
  downloadCompanyDocFile,
} from '@/lib/company-documents/fileResponse'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

/** Stream or download the document via magic link (no login). */
export async function GET(request: NextRequest, context: Ctx) {
  const { token } = await context.params
  const row = await resolveCompanyDocAccessToken(token)
  if (!row) {
    return NextResponse.json({ error: 'Link expired or invalid' }, { status: 404 })
  }

  const result = await downloadCompanyDocFile(row)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // Opening/downloading counts as viewed for VIEW_ONLY (and soft-views ACKNOWLEDGMENT)
  const now = new Date()
  if (!row.viewedAt || row.status === 'PENDING') {
    const nextStatus =
      row.status === 'SIGNED' || row.status === 'SUBMITTED'
        ? row.status
        : row.companyDocument.documentType === 'VIEW_ONLY'
          ? 'VIEWED'
          : row.status === 'PENDING'
            ? 'VIEWED'
            : row.status

    await prisma.companyDocumentRecipient.update({
      where: { id: row.id },
      data: {
        viewedAt: row.viewedAt ?? now,
        status: nextStatus,
      },
    })
  }

  const download = request.nextUrl.searchParams.get('download') === '1'
  return companyDocFileResponse(row, result.buf, download ? 'attachment' : 'inline')
}

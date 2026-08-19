import { NextRequest, NextResponse } from 'next/server'
import { resolveCompanyDocAccessToken } from '@/lib/company-documents/accessToken'
import { assertCompanyDocPublicRateLimit } from '@/lib/company-documents/publicRateLimit'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

/** Public metadata for a company-doc magic link. */
export async function GET(request: NextRequest, context: Ctx) {
  const rateLimited = await assertCompanyDocPublicRateLimit(request, 'meta')
  if (rateLimited) return rateLimited

  const { token } = await context.params
  const row = await resolveCompanyDocAccessToken(token)
  if (!row) {
    return NextResponse.json({ error: 'Link expired or invalid' }, { status: 404 })
  }

  return NextResponse.json({
    title: row.companyDocument.title,
    description: row.companyDocument.description,
    documentType: row.companyDocument.documentType,
    fileType: row.companyDocument.fileType,
    status: row.status,
    signedName: row.signedName,
    signedAt: row.signedAt?.toISOString() ?? null,
    viewedAt: row.viewedAt?.toISOString() ?? null,
    firstName: row.rbtProfile.firstName,
    expectedFullName: `${row.rbtProfile.firstName} ${row.rbtProfile.lastName}`.trim(),
  })
}

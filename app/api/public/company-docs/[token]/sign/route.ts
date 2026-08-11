import { NextRequest, NextResponse } from 'next/server'
import { resolveCompanyDocAccessToken } from '@/lib/company-documents/accessToken'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

/** Typed e-sign acknowledgment via magic link (no login). */
export async function POST(request: NextRequest, context: Ctx) {
  const { token } = await context.params
  const row = await resolveCompanyDocAccessToken(token)
  if (!row) {
    return NextResponse.json({ error: 'Link expired or invalid' }, { status: 404 })
  }
  if (row.companyDocument.documentType !== 'ACKNOWLEDGMENT') {
    return NextResponse.json({ error: 'This document does not require a signature' }, { status: 400 })
  }
  if (row.status === 'SIGNED') {
    return NextResponse.json({
      recipient: {
        id: row.id,
        status: row.status,
        signedName: row.signedName,
        signedAt: row.signedAt?.toISOString() ?? null,
      },
    })
  }

  const body = await request.json().catch(() => ({}))
  const signedName = typeof body?.signedName === 'string' ? body.signedName.trim() : ''
  if (signedName.split(/\s+/).filter(Boolean).length < 2) {
    return NextResponse.json(
      { error: 'Type your full name (first and last) to sign' },
      { status: 400 }
    )
  }

  const now = new Date()
  const ip = getClientIpFromRequest(request)

  const updated = await prisma.companyDocumentRecipient.update({
    where: { id: row.id },
    data: {
      status: 'SIGNED',
      signedName,
      signedAt: now,
      signatureIp: ip,
      viewedAt: row.viewedAt ?? now,
    },
  })

  return NextResponse.json({
    recipient: {
      id: updated.id,
      status: updated.status,
      signedName: updated.signedName,
      signedAt: updated.signedAt?.toISOString() ?? null,
    },
  })
}

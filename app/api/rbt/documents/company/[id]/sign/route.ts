import { NextRequest, NextResponse } from 'next/server'
import { requireRbtSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { isCompanyDocTestEmail } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRbtSession()
  if (auth.response) return auth.response
  const rbtProfileId = auth.user.rbtProfileId!
  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const signedName = typeof body?.signedName === 'string' ? body.signedName.trim() : ''
  if (signedName.split(/\s+/).filter(Boolean).length < 2) {
    return NextResponse.json({ error: 'Type your full name (first and last) to sign' }, { status: 400 })
  }

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
  if (row.companyDocument.documentType !== 'ACKNOWLEDGMENT') {
    return NextResponse.json({ error: 'This document does not require a signature' }, { status: 400 })
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

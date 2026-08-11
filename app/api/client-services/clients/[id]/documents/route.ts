import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesSession,
  enforceClientScope,
} from '@/lib/client-services/access'
import { logClientAccess } from '@/lib/client-services/audit'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth
  const { id: clientId } = await context.params

  const denied = await enforceClientScope(user, scope, clientId, request)
  if (denied) return denied

  let body: {
    documentId?: string
    collected?: boolean
    notes?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.documentId) {
    return NextResponse.json({ error: 'documentId required' }, { status: 400 })
  }

  const doc = await prisma.serviceClientDocument.findFirst({
    where: { id: body.documentId, serviceClientId: clientId },
  })
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const collected = body.collected ?? doc.collected
  const updated = await prisma.serviceClientDocument.update({
    where: { id: doc.id },
    data: {
      collected,
      collectedAt: collected ? doc.collectedAt ?? new Date() : null,
      collectedBy: collected ? user.id : null,
      notes: body.notes !== undefined ? body.notes : doc.notes,
    },
  })

  await logClientAccess({
    userId: user.id,
    serviceClientId: clientId,
    action: 'DOCUMENT_EDIT',
    ip: getClientIpFromRequest(request),
  })

  const { addClientTimelineNote } = await import('@/lib/client-services/timeline')
  await addClientTimelineNote({
    serviceClientId: clientId,
    authorId: user.id,
    content: collected
      ? `[Document] Marked collected: ${doc.documentType}`
      : `[Document] Marked missing: ${doc.documentType}`,
  })

  return NextResponse.json({ document: updated })
}

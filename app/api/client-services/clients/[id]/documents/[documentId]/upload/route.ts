import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { STORAGE_BUCKET } from '@/lib/constants'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesSession,
  enforceClientScopeForEdit,
} from '@/lib/client-services/access'
import { logClientAccess } from '@/lib/client-services/audit'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; documentId: string }> }

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth
  const { id: clientId, documentId } = await context.params

  const denied = await enforceClientScopeForEdit(user, scope, clientId, request)
  if (denied) return denied

  const doc = await prisma.serviceClientDocument.findFirst({
    where: { id: documentId, serviceClientId: clientId },
  })
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `client-services/${clientId}/${doc.documentType}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }

  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) {
    console.error('[client-services] upload failed', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 502 })
  }

  const updated = await prisma.serviceClientDocument.update({
    where: { id: doc.id },
    data: {
      fileUrl: path,
      collected: true,
      collectedAt: new Date(),
      collectedBy: user.id,
    },
  })

  await logClientAccess({
    userId: user.id,
    serviceClientId: clientId,
    action: 'DOCUMENT_UPLOAD',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({ document: updated })
}

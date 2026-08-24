import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanEditClient,
  auditClientAction,
  CrmAccessError,
  fetchUserCrmRoles,
} from '@/lib/crm/access'
import { computeExpiresAt } from '@/lib/crm/documents'
import {
  uploadRequirementDocument,
  validateRequirementDocumentFile,
} from '@/lib/crm/requirementDocuments'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; requirementId: string }> }

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, requirementId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    await assertCanEditClient(subject, clientId)

    const requirement = await prisma.clientRequirement.findFirst({
      where: {
        id: requirementId,
        serviceClientId: clientId,
        deletedAt: null,
        type: 'DOCUMENT',
      },
    })
    if (!requirement) {
      return NextResponse.json({ error: 'Document requirement not found' }, { status: 404 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    const check = validateRequirementDocumentFile({
      name: file.name,
      size: file.size,
      type: file.type,
    })
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadRequirementDocument({
      clientId,
      requirementKey: requirement.key,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes,
    })

    const now = new Date()
    const updated = await prisma.clientRequirement.update({
      where: { id: requirement.id },
      data: {
        status: 'RECEIVED',
        fileUrl: uploaded.storagePath,
        fileName: uploaded.fileName,
        fileContentType: uploaded.contentType,
        fileSizeBytes: uploaded.sizeBytes,
        completedAt: now,
        completedByUserId: user.id,
        attestedAt: null,
        attestedByUserId: null,
        expiresAt: computeExpiresAt(requirement.key, now),
      },
      select: {
        id: true,
        key: true,
        label: true,
        status: true,
        fileName: true,
        fileSizeBytes: true,
        completedAt: true,
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `REQUIREMENT_DOCUMENT_UPLOAD:${requirement.key}`,
      ip: getClientIpFromRequest(request),
    })

    return NextResponse.json({ requirement: updated })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[crm-requirements] upload', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

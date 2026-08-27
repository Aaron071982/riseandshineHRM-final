import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { auditClientAction, CrmAccessError } from '@/lib/crm/access'
import {
  attachRequirementDocumentRecord,
  MAX_REQUIREMENT_DOCUMENT_BYTES,
  validateRequirementDocumentFile,
} from '@/lib/crm/requirementDocuments'
import { loadUploadableRequirement } from '@/lib/crm/requirementUploadAccess'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string; requirementId: string }> }

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId, requirementId } = await context.params

  try {
    const requirement = await loadUploadableRequirement(
      user,
      clientId,
      requirementId
    )

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const storagePath = String(body.storagePath ?? '').trim()
    const fileName = String(body.fileName ?? '').trim()
    const contentType = String(body.contentType ?? 'application/octet-stream').trim()
    const sizeBytes = Number(body.sizeBytes)

    if (!storagePath || !fileName) {
      return NextResponse.json(
        { error: 'storagePath and fileName are required' },
        { status: 400 }
      )
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json({ error: 'sizeBytes is required' }, { status: 400 })
    }

    const check = validateRequirementDocumentFile({
      name: fileName,
      size: sizeBytes,
      type: contentType,
    })
    if (!check.ok) {
      const status = sizeBytes > MAX_REQUIREMENT_DOCUMENT_BYTES ? 413 : 400
      return NextResponse.json({ error: check.error }, { status })
    }

    const updated = await attachRequirementDocumentRecord({
      requirementId: requirement.id,
      clientId,
      userId: user.id,
      requirementKey: requirement.key,
      storagePath,
      fileName,
      contentType,
      sizeBytes,
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
    console.error('[crm-requirements] attach', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not attach file' },
      { status: 500 }
    )
  }
}

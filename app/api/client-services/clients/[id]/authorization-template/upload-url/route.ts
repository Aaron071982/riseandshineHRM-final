import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  assertCanEditClient,
  auditClientAction,
  CrmAccessError,
  fetchUserCrmRoles,
} from '@/lib/crm/access'
import { assertCanAccessBillingSurface } from '@/lib/crm/billingAccess'
import {
  createAuthTemplateSignedUpload,
  MAX_AUTH_TEMPLATE_BYTES,
  validateAuthTemplateFile,
} from '@/lib/crm/authorizationTemplate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth
  const { id: clientId } = await context.params

  try {
    const crmRoles = await fetchUserCrmRoles(user.id)
    const subject = { ...user, crmRoles }
    assertCanAccessBillingSurface(subject)
    await assertCanEditClient(subject, clientId)

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const fileName = String(body.fileName ?? '').trim()
    const contentType = String(body.contentType ?? 'application/octet-stream').trim()
    const sizeBytes = Number(body.sizeBytes)

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json({ error: 'sizeBytes is required' }, { status: 400 })
    }

    const check = validateAuthTemplateFile({
      name: fileName,
      size: sizeBytes,
      type: contentType,
    })
    if (!check.ok) {
      const status = sizeBytes > MAX_AUTH_TEMPLATE_BYTES ? 413 : 400
      return NextResponse.json({ error: check.error }, { status })
    }

    const signed = await createAuthTemplateSignedUpload({
      clientId,
      fileName,
      contentType,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: 'AUTH_TEMPLATE_UPLOAD_URL',
      ip: getClientIpFromRequest(request),
    })

    return NextResponse.json({
      signedUrl: signed.signedUrl,
      token: signed.token,
      storagePath: signed.storagePath,
      contentType: signed.contentType,
    })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[crm-auth-template] upload-url', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not prepare upload' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesSession,
} from '@/lib/client-services/access'
import {
  assertCanEditClient,
  auditClientAction,
  CrmAccessError,
  fetchUserCrmRoles,
  isFullAccess,
} from '@/lib/crm/access'
import {
  uploadEmailAttachment,
  validateEmailAttachmentFile,
} from '@/lib/crm/emails/attachments'
import { prisma } from '@/lib/prisma'

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
    await assertCanEditClient(subject, clientId)

    if (!isFullAccess(subject)) {
      const client = await prisma.serviceClient.findUnique({
        where: { id: clientId },
        select: { currentOwnerUserId: true, caseCoordinatorUserId: true },
      })
      if (!client) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      const claimed =
        client.currentOwnerUserId === user.id ||
        client.caseCoordinatorUserId === user.id
      if (!claimed) {
        return NextResponse.json(
          {
            error:
              'You must claim this client (or be assigned as case coordinator) before attaching files',
          },
          { status: 403 }
        )
      }
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    const check = validateEmailAttachmentFile({
      name: file.name,
      size: file.size,
      type: file.type,
    })
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const attachment = await uploadEmailAttachment({
      clientId,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes,
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `EMAIL_ATTACHMENT_UPLOAD:${attachment.fileName}`,
      ip: getClientIpFromRequest(request),
    })

    return NextResponse.json({ attachment })
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[crm-email] attachment upload', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

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

export async function POST(request: NextRequest, context: Ctx) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user, scope } = auth
  const { id } = await context.params

  const denied = await enforceClientScope(user, scope, id, request)
  if (denied) return denied

  let body: { content?: string; title?: string; details?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { formatActivityNote } = await import('@/lib/client-services/activityNote')
  const content =
    body.title != null || body.details != null
      ? formatActivityNote(String(body.title ?? ''), body.details)
      : (body.content ?? '').trim()
  if (!content) {
    return NextResponse.json({ error: 'title or content required' }, { status: 400 })
  }

  const note = await prisma.serviceClientNote.create({
    data: {
      serviceClientId: id,
      authorId: user.id,
      content,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  })

  await logClientAccess({
    userId: user.id,
    serviceClientId: id,
    action: 'NOTE_CREATE',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({ note })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CLIENT_NOTE_TYPES } from '@/lib/crm-client/constants'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const { id: clientId } = await context.params

  try {
    const body = await request.json().catch(() => ({}))
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    const noteType = typeof body.noteType === 'string' ? body.noteType.trim().toUpperCase() : 'GENERAL'

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }
    if (!CLIENT_NOTE_TYPES.includes(noteType as (typeof CLIENT_NOTE_TYPES)[number])) {
      return NextResponse.json({ error: 'Invalid noteType' }, { status: 400 })
    }

    const client = await prisma.crmClient.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const note = await prisma.clientNote.create({
      data: {
        clientId,
        authorId: auth.user.id,
        content,
        noteType,
      },
    })

    return NextResponse.json({ note })
  } catch (e) {
    console.error('[POST client notes]', e)
    return NextResponse.json({ error: 'Failed to create note', details: String(e) }, { status: 500 })
  }
}

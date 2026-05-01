import { NextRequest, NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; noteId: string }> }
) {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const { id: clientId, noteId } = await context.params

  try {
    const note = await prisma.clientNote.findFirst({
      where: { id: noteId, clientId },
    })
    if (!note) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (note.authorId !== auth.user.id) {
      return NextResponse.json({ error: 'You can only delete your own notes' }, { status: 403 })
    }

    await prisma.clientNote.delete({ where: { id: noteId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[DELETE note]', e)
    return NextResponse.json({ error: 'Failed to delete note', details: String(e) }, { status: 500 })
  }
}

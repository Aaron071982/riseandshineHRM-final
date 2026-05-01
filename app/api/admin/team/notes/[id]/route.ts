import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, isAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  const prismaAny = prisma as unknown as {
    adminCalendarNote?: {
      findUnique: (args: unknown) => Promise<{ id: string; userId: string } | null>
      delete: (args: unknown) => Promise<unknown>
    }
  }
  if (!prismaAny.adminCalendarNote?.findUnique || !prismaAny.adminCalendarNote?.delete) {
    return NextResponse.json({ error: 'Calendar notes are not enabled until DB migration is applied.' }, { status: 503 })
  }

  const note = await prismaAny.adminCalendarNote.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })
  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }
  if (note.userId !== auth.user.id && !isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prismaAny.adminCalendarNote.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

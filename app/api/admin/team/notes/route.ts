import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, isAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const date = typeof body.date === 'string' ? new Date(body.date) : null
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!date || isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }
  if (!content) {
    return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
  }

  const prismaAny = prisma as unknown as {
    adminCalendarNote?: {
      create: (args: unknown) => Promise<{
        id: string
        userId: string
        date: Date
        content: string
        color: string | null
        isPinned: boolean
        createdAt: Date
        user: { name: string | null; email: string | null }
      }>
      findUnique: (args: unknown) => Promise<{ id: string; userId: string } | null>
      delete: (args: unknown) => Promise<unknown>
    }
  }

  if (!prismaAny.adminCalendarNote?.create) {
    return NextResponse.json({ error: 'Calendar notes are not enabled until DB migration is applied.' }, { status: 503 })
  }

  const note = await prismaAny.adminCalendarNote.create({
    data: {
      userId: auth.user.id,
      date,
      content: content.slice(0, 1200),
      color: typeof body.color === 'string' ? body.color.trim().slice(0, 20) : null,
      isPinned: Boolean(body.isPinned),
    },
    select: {
      id: true,
      userId: true,
      date: true,
      content: true,
      color: true,
      isPinned: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json({
    note: {
      ...note,
      authorName: note.user.name ?? note.user.email ?? 'Admin',
    },
  })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const noteId = typeof body.id === 'string' ? body.id : ''
  if (!noteId) {
    return NextResponse.json({ error: 'Missing note id' }, { status: 400 })
  }

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
    where: { id: noteId },
    select: { id: true, userId: true },
  })
  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }
  if (note.userId !== auth.user.id && !isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prismaAny.adminCalendarNote.delete({ where: { id: noteId } })
  return NextResponse.json({ success: true })
}

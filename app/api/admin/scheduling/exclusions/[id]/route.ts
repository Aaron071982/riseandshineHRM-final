import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const deleted = await prisma.$executeRaw`
    DELETE FROM scheduling_exclusions WHERE id = ${id}
  `

  return NextResponse.json({ success: true, deleted })
}

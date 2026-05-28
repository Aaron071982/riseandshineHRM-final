import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response
  const { id } = await params
  const logs = await prisma.oigScreeningLog.findMany({
    where: { rbtProfileId: id },
    orderBy: { screenedAt: 'desc' },
  })
  return NextResponse.json({ logs })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response
  const { id } = await params
  const body = await request.json()
  const log = await prisma.oigScreeningLog.create({
    data: {
      rbtProfileId: id,
      screenedBy: auth.user!.id,
      samResult: body.samResult ?? null,
      oigResult: body.oigResult ?? null,
      omigResult: body.omigResult ?? null,
      notes: body.notes ?? null,
    },
  })
  return NextResponse.json({ log })
}

import { NextResponse } from 'next/server'
import { requireClientManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireClientManagerSession()
  if (auth.response) return auth.response

  const list = await prisma.bCBAProfile.findMany({
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, email: true },
  })
  return NextResponse.json({ bcbas: list })
}

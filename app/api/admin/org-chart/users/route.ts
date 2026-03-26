import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Lightweight user list for org node "link to system user" picker. */
export async function GET() {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        rbtProfile: { select: { id: true } },
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: 2000,
    })

    return NextResponse.json({ users })
  } catch (e) {
    console.error('GET /api/admin/org-chart/users', e)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}

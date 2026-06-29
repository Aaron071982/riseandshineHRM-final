import { NextResponse } from 'next/server'
import { requireTrainingPortalSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireTrainingPortalSession()
  if (auth.response) return auth.response

  const requests = await prisma.artemisSessionRequest.findMany({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'asc' },
    include: {
      rbtProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
        },
      },
    },
  })

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      message: r.message,
      createdAt: r.createdAt,
      rbtProfileId: r.rbtProfileId,
      rbtName: `${r.rbtProfile.firstName} ${r.rbtProfile.lastName}`,
      phoneNumber: r.rbtProfile.phoneNumber,
      email: r.rbtProfile.email,
    })),
  })
}

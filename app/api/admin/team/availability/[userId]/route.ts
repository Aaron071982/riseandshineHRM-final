import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { userId } = await params
  const prismaAny = prisma as unknown as {
    adminAvailability?: { findMany: (args: unknown) => Promise<unknown[]> }
    interviewerAvailability?: { findMany: (args: unknown) => Promise<unknown[]> }
  }

  const rows = prismaAny.adminAvailability?.findMany
    ? await prismaAny.adminAvailability.findMany({
        where: { userId, isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }, { startMinute: 'asc' }],
      })
    : prismaAny.interviewerAvailability?.findMany
      ? await prismaAny.interviewerAvailability.findMany({
          where: { userId, isActive: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }, { startMinute: 'asc' }],
        })
      : []

  return NextResponse.json({ availability: rows })
}

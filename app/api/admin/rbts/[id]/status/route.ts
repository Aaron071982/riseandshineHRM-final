import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { status } = await request.json()

    const previous = await prisma.rBTProfile.findUnique({
      where: { id },
      select: { status: true },
    })
    if (!previous) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    // Use transaction to ensure both updates happen atomically
    const result = await prisma.$transaction(async (tx) => {
      if (status === 'INTERVIEW_COMPLETED') {
        await tx.interview.updateMany({
          where: { rbtProfileId: id, status: 'SCHEDULED' },
          data: { status: 'COMPLETED' },
        })
      }

      const rbtProfile = await tx.rBTProfile.update({
        where: { id },
        data: { status },
      })

      await tx.rBTAuditLog.create({
        data: {
          rbtProfileId: id,
          auditType: 'STATUS_CHANGE',
          dateTime: new Date(),
          notes: `Status changed from ${previous.status} to ${status}`,
          createdBy: user?.email || user?.name || 'Admin',
        },
      })

      return rbtProfile
    })

    return NextResponse.json({ status: result.status })
  } catch (error) {
    console.error('Error updating status:', error)
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    )
  }
}


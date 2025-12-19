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

    // If marking interview as completed, also update all scheduled interviews to COMPLETED
    if (status === 'INTERVIEW_COMPLETED') {
      // Update all scheduled interviews for this RBT to COMPLETED
      await prisma.interview.updateMany({
        where: {
          rbtProfileId: id,
          status: 'SCHEDULED',
        },
        data: {
          status: 'COMPLETED',
        },
      })
    }

    const rbtProfile = await prisma.rBTProfile.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json({ status: rbtProfile.status })
  } catch (error) {
    console.error('Error updating status:', error)
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    )
  }
}


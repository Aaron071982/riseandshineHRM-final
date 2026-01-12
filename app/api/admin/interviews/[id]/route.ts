import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const interview = await prisma.interview.findUnique({
      where: { id },
      include: {
        rbtProfile: true,
      },
    })

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Delete the interview (cascade will handle related records)
    await prisma.interview.delete({
      where: { id },
    })

    // Check if this was the only scheduled interview and revert status if needed
    const remainingInterviews = await prisma.interview.findMany({
      where: {
        rbtProfileId: interview.rbtProfileId,
        status: 'SCHEDULED',
      },
    })

    // If no scheduled interviews remain and status is INTERVIEW_SCHEDULED, revert to previous status
    if (remainingInterviews.length === 0 && interview.rbtProfile.status === 'INTERVIEW_SCHEDULED') {
      await prisma.rBTProfile.update({
        where: { id: interview.rbtProfileId },
        data: { status: 'REACH_OUT_EMAIL_SENT' },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Interview deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting interview:', error)
    return NextResponse.json(
      { error: 'Failed to delete interview' },
      { status: 500 }
    )
  }
}

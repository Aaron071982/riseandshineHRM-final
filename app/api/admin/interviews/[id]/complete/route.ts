import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function PATCH(
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

    if (interview.status !== 'SCHEDULED') {
      return NextResponse.json(
        { error: 'Interview is not in SCHEDULED status' },
        { status: 400 }
      )
    }

    // Update interview status
    await prisma.interview.update({
      where: { id },
      data: { status: 'COMPLETED' },
    })

    const previousStatus = interview.rbtProfile.status
    await prisma.rBTProfile.update({
      where: { id: interview.rbtProfileId },
      data: { status: 'INTERVIEW_COMPLETED' },
    })
    await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: interview.rbtProfileId,
        auditType: 'STATUS_CHANGE',
        dateTime: new Date(),
        notes: `Interview marked completed. Status changed from ${previousStatus} to INTERVIEW_COMPLETED`,
        createdBy: user?.email || user?.name || 'Admin',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Interview marked as completed',
    })
  } catch (error: any) {
    console.error('Error completing interview:', error)
    return NextResponse.json(
      { error: 'Failed to complete interview' },
      { status: 500 }
    )
  }
}

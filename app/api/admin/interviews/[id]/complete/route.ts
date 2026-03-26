import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

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

    const body = await request.json().catch(() => ({}))
    const decision = body?.decision === 'REJECTED' ? 'REJECTED' : body?.decision === 'OFFERED' ? 'OFFERED' : 'PENDING'

    await prisma.interview.update({
      where: { id },
      data: { status: 'COMPLETED', decision },
    })

    const previousStatus = interview.rbtProfile.status
    const newProfileStatus = decision === 'REJECTED' ? 'REJECTED' : 'INTERVIEW_COMPLETED'
    await prisma.rBTProfile.update({
      where: { id: interview.rbtProfileId },
      data: { status: newProfileStatus },
    })
    await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: interview.rbtProfileId,
        auditType: 'STATUS_CHANGE',
        dateTime: new Date(),
        notes: `Interview marked completed (${decision}). Status changed from ${previousStatus} to ${newProfileStatus}`,
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

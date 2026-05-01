import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession, isAdmin } from '@/lib/auth'
import { makePublicUrl } from '@/lib/baseUrl'
import { sendGenericEmail } from '@/lib/email/core'
import { generateInterviewUnclaimedEmail } from '@/lib/email/generators'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''

    const interview = await prisma.interview.findUnique({
      where: { id },
      include: {
        rbtProfile: { select: { id: true, firstName: true, lastName: true } },
        claimedBy: { select: { id: true, name: true, email: true } },
      },
    })
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }
    if (interview.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Cannot unclaim a completed interview' }, { status: 400 })
    }
    if (!interview.claimedByUserId) {
      return NextResponse.json({ error: 'Interview is already unclaimed' }, { status: 400 })
    }

    const userIsAdmin = isAdmin(auth.user)
    if (interview.claimedByUserId !== auth.user.id && !userIsAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const previousClaimerName =
      interview.claimedBy?.name ?? interview.claimedBy?.email ?? interview.interviewerName ?? 'Admin'

    const updated = await prisma.interview.update({
      where: { id },
      data: {
        claimedByUserId: null,
        interviewerName: 'Interviewer TBD',
      },
      include: {
        rbtProfile: { select: { id: true, firstName: true, lastName: true } },
        claimedBy: { select: { id: true, name: true, email: true } },
      },
    })

    const candidateName = `${updated.rbtProfile.firstName} ${updated.rbtProfile.lastName}`
    const profileUrl = makePublicUrl(`/admin/rbts/${updated.rbtProfile.id}`)
    const claimUrl = makePublicUrl('/admin/interviews')
    const now = Date.now()
    const isUrgent = new Date(updated.scheduledAt).getTime() - now <= 24 * 60 * 60 * 1000

    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true, email: true, name: true },
      })

      for (const admin of admins) {
        if (admin.email) {
          const { subject, html } = generateInterviewUnclaimedEmail({
            candidateName,
            profileUrl,
            scheduledAt: updated.scheduledAt,
            previousClaimerName,
            claimUrl,
            reason: reason || null,
            isUrgent,
          })
          await sendGenericEmail(admin.email, subject, html).catch(() => {})
        }

        await prisma.adminNotification.create({
          data: {
            userId: admin.id,
            type: 'INTERVIEW_UNCLAIMED',
            message: `Interview unclaimed: ${candidateName} (${previousClaimerName} released claim)`,
            linkUrl: '/admin/interviews',
          },
        }).catch(() => {})
      }
    } catch (e) {
      console.error('[unclaim] notify error:', e)
    }

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        activityType: 'BUTTON_CLICK',
        action: 'Interview unclaimed',
        resourceType: 'Interview',
        resourceId: updated.id,
        url: '/admin/interviews',
        metadata: {
          candidateName,
          previousClaimerName,
          reason: reason || null,
          forced: interview.claimedByUserId !== auth.user.id,
        },
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      interview: {
        id: updated.id,
        scheduledAt: updated.scheduledAt,
        status: updated.status,
        interviewerName: updated.interviewerName,
        claimedByUserId: updated.claimedByUserId,
        candidateName,
      },
    })
  } catch (error: unknown) {
    console.error('Error unclaiming interview:', error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? String((error as Error)?.message) : 'Failed to unclaim interview' },
      { status: 500 }
    )
  }
}

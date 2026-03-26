import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { sendGenericEmail } from '@/lib/email/core'
import { generateInterviewClaimedEmail } from '@/lib/email/generators'
import { makePublicUrl } from '@/lib/baseUrl'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const interview = await prisma.interview.findUnique({
      where: { id },
      include: { rbtProfile: true },
    })

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    if (interview.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'Interview is not in SCHEDULED status' }, { status: 400 })
    }

    if (interview.claimedByUserId) {
      return NextResponse.json({ error: 'Interview already claimed' }, { status: 409 })
    }

    const claimerName = user.name || user.email || 'Admin'
    const updateData: Record<string, unknown> = { claimedByUserId: user.id }

    if (interview.interviewerName === 'Interviewer TBD') {
      updateData.interviewerName = claimerName
    }

    await prisma.interview.update({ where: { id }, data: updateData })

    const candidateName = `${interview.rbtProfile.firstName} ${interview.rbtProfile.lastName}`

    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true, email: true, name: true },
      })

      for (const admin of admins) {
        if (!admin.email) continue
        const isForClaimer = admin.id === user.id
        const { subject, html } = generateInterviewClaimedEmail(
          claimerName,
          candidateName,
          interview.scheduledAt,
          isForClaimer
        )
        await sendGenericEmail(admin.email, subject, html)

        if (!isForClaimer) {
          await prisma.adminNotification.create({
            data: {
              userId: admin.id,
              type: 'INTERVIEW_CLAIMED',
              message: `${claimerName} claimed interview with ${candidateName}`,
              linkUrl: makePublicUrl(`/admin/interviews`),
            },
          }).catch(() => {})
        }
      }
    } catch (e) {
      console.error('[claim] notification error:', e)
    }

    return NextResponse.json({ success: true, claimedBy: claimerName })
  } catch (error: unknown) {
    console.error('Error claiming interview:', error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? String((error as Error)?.message) : 'Failed to claim interview' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const interview = await prisma.interview.findUnique({ where: { id } })

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    if (!interview.claimedByUserId) {
      return NextResponse.json({ error: 'Interview is not claimed' }, { status: 400 })
    }

    await prisma.interview.update({
      where: { id },
      data: { claimedByUserId: null },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error unclaiming interview:', error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? String((error as Error)?.message) : 'Failed to unclaim interview' },
      { status: 500 }
    )
  }
}

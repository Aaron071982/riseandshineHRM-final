import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const { id } = await params

    const interview = await prisma.interview.findUnique({
      where: { id },
      include: {
        rbtProfile: {
          include: {
            availabilitySlots: true,
            user: { select: { email: true, name: true } },
          },
        },
        interviewNotes: true,
        scorecards: true,
      },
    })

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    return NextResponse.json({
      notes: interview.interviewNotes || null,
      interview: {
        id: interview.id,
        scheduledAt: interview.scheduledAt,
        status: interview.status,
        decision: interview.decision,
        interviewerName: interview.interviewerName,
        meetingUrl: interview.meetingUrl,
        claimedByUserId: (interview as Record<string, unknown>).claimedByUserId ?? null,
      },
      rbtProfile: interview.rbtProfile,
      scorecards: interview.scorecards,
    })
  } catch (error: unknown) {
    const err = error as Error & { code?: string; meta?: unknown }
    console.error('[notes/GET] Error:', err?.message, err?.code)
    return NextResponse.json(
      { error: 'Failed to fetch interview notes' },
      { status: 500 }
    )
  }
}

function strOrNull(v: unknown): string | null {
  if (v == null || v === '') return null
  return String(v)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const { id } = await params

    let data: Record<string, unknown>
    try {
      data = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (data == null || typeof data !== 'object') {
      data = {}
    }

    const interview = await prisma.interview.findUnique({
      where: { id },
    })

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    const updateData = {
      greetingAnswer: strOrNull(data.greetingAnswer),
      basicInfoAnswer: strOrNull(data.basicInfoAnswer),
      experienceAnswer: strOrNull(data.experienceAnswer),
      heardAboutAnswer: strOrNull(data.heardAboutAnswer),
      abaPlatformsAnswer: strOrNull(data.abaPlatformsAnswer),
      communicationAnswer: strOrNull(data.communicationAnswer),
      availabilityAnswer: strOrNull(data.availabilityAnswer),
      payExpectationsAnswer: strOrNull(data.payExpectationsAnswer),
      previousCompanyAnswer: strOrNull(data.previousCompanyAnswer),
      expectationsAnswer: strOrNull(data.expectationsAnswer),
      closingNotes: strOrNull(data.closingNotes),
      quickNotes: strOrNull(data.quickNotes),
      fullName: strOrNull(data.fullName),
      email: strOrNull(data.email),
      birthdate: strOrNull(data.birthdate),
      currentAddress: strOrNull(data.currentAddress),
      phoneNumber: strOrNull(data.phoneNumber),
      recommendation: strOrNull(data.recommendation),
    }

    console.log('[notes/POST] Saving notes for interview:', id, {
      hasQuickNotes: !!updateData.quickNotes,
      recommendation: updateData.recommendation,
      hasFullName: !!updateData.fullName,
    })

    const notes = await prisma.interviewNotes.upsert({
      where: { interviewId: id },
      update: updateData,
      create: {
        interviewId: id,
        rbtProfileId: interview.rbtProfileId,
        ...updateData,
      },
    })

    console.log('[notes/POST] Saved successfully:', notes.id)

    if (data.updateProfile === true) {
      const profileUpdate: Record<string, string> = {}
      if (updateData.fullName) {
        const parts = updateData.fullName.trim().split(/\s+/)
        profileUpdate.firstName = parts[0]
        if (parts.length > 1) profileUpdate.lastName = parts.slice(1).join(' ')
      }
      if (updateData.phoneNumber) profileUpdate.phoneNumber = updateData.phoneNumber
      if (updateData.email) profileUpdate.email = updateData.email
      if (updateData.currentAddress) profileUpdate.locationCity = updateData.currentAddress

      if (Object.keys(profileUpdate).length > 0) {
        await prisma.rBTProfile.update({
          where: { id: interview.rbtProfileId },
          data: profileUpdate,
        }).catch((e) => console.error('[notes/POST] profile update error:', e))
      }
    }

    return NextResponse.json({ success: true, notes })
  } catch (error: unknown) {
    const err = error as Error & { code?: string; meta?: unknown }
    console.error('[notes/POST] Error:', err?.message, err?.code, err?.meta)
    const message =
      process.env.NODE_ENV === 'development' && err?.message
        ? err.message
        : 'Failed to save interview notes'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

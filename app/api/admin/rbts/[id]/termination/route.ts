import { NextRequest, NextResponse } from 'next/server'
import { TerminationReason } from '@prisma/client'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { finalizeTermination } from '@/lib/termination/finalize'
import { computeTerminationDates } from '@/lib/termination/dates'

const TERMINATION_REASONS = new Set<string>(Object.values(TerminationReason))

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  const termination = await prisma.termination.findUnique({
    where: { rbtProfileId: id },
    include: {
      tasks: { orderBy: { type: 'asc' } },
      documents: { orderBy: { generatedAt: 'asc' } },
      decisionMaker: { select: { id: true, name: true, email: true } },
    },
  })

  if (!termination) {
    return NextResponse.json({ termination: null })
  }

  return NextResponse.json({ termination })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user!
    const { id } = await params
    const body = await request.json()

    const reason = body?.reason as string
    if (!TERMINATION_REASONS.has(reason)) {
      return NextResponse.json({ error: 'Invalid termination reason category' }, { status: 400 })
    }

    const reasonNarrative = typeof body?.reasonNarrative === 'string' ? body.reasonNarrative.trim() : ''
    if (!reasonNarrative) {
      return NextResponse.json({ error: 'Reason narrative is required' }, { status: 400 })
    }

    const terminationDate = new Date(body?.terminationDate)
    const lastDayWorked = new Date(body?.lastDayWorked ?? body?.terminationDate)
    if (Number.isNaN(terminationDate.getTime())) {
      return NextResponse.json({ error: 'Valid termination date is required' }, { status: 400 })
    }

    const computed = computeTerminationDates(terminationDate)
    const benefitsEndDate = body?.benefitsEndDate ? new Date(body.benefitsEndDate) : computed.benefitsEndDate
    const finalPayDate = body?.finalPayDate ? new Date(body.finalPayDate) : computed.finalPayDate
    const noticeDeadline = body?.noticeDeadline ? new Date(body.noticeDeadline) : computed.noticeDeadline

    if (body?.redFlagPresent && !body?.counselConsulted) {
      return NextResponse.json(
        { error: 'Consult employment counsel before finalizing when red-flag timing applies' },
        { status: 400 }
      )
    }

    if (!body?.reasonDocumented || !body?.consistencyChecked || !body?.contractChecked) {
      return NextResponse.json({ error: 'Complete all compliance checklist items' }, { status: 400 })
    }

    const profile = await prisma.rBTProfile.findUnique({
      where: { id },
      select: { email: true },
    })
    if (!profile?.email?.trim()) {
      return NextResponse.json({ error: 'Employee must have an email on file' }, { status: 400 })
    }

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    const result = await finalizeTermination({
      rbtProfileId: id,
      decisionMakerId: user.id,
      actorLabel: user.email || user.name || 'Admin',
      reason: reason as TerminationReason,
      reasonNarrative,
      terminationDate,
      lastDayWorked,
      benefitsEndDate,
      finalPayDate,
      noticeDeadline,
      counselConsulted: !!body?.counselConsulted,
      reasonDocumented: !!body?.reasonDocumented,
      consistencyChecked: !!body?.consistencyChecked,
      redFlagPresent: !!body?.redFlagPresent,
      contractChecked: !!body?.contractChecked,
      regularWages: body?.regularWages,
      overtimeOwed: body?.overtimeOwed,
      commissionsOwed: body?.commissionsOwed,
      ptoPayout: body?.ptoPayout,
      deductions: body?.deductions,
      netFinalPay: body?.netFinalPay,
      otherBenefitName: body?.otherBenefitName,
      otherBenefitEndDate: body?.otherBenefitEndDate ? new Date(body.otherBenefitEndDate) : null,
      ehrSystemName: body?.ehrSystemName,
      propertyList: body?.propertyList,
      coveragePlan: body?.coveragePlan,
      ipAddress,
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({
      success: true,
      terminationId: result.termination.id,
      noticeDeadline: result.termination.noticeDeadline,
    })
  } catch (error) {
    console.error('[termination/finalize]', error)
    const message = error instanceof Error ? error.message : 'Failed to finalize termination'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

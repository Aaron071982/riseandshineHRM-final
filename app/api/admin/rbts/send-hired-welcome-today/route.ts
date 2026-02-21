import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, generateManualHireOnboardingEmail, EmailTemplateType } from '@/lib/email'

/**
 * POST /api/admin/rbts/send-hired-welcome-today
 * Sends the "Welcome to Rise and Shine – You're Hired!" onboarding email to all RBTs
 * who are HIRED and were updated/created in the given window.
 * Query params:
 *   - hours=N (optional): only RBTs whose updatedAt or createdAt is within the last N hours (e.g. ?hours=2).
 *   - If omitted: uses "today" (start of UTC day).
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const now = new Date()
    const url = new URL(request.url)
    const hoursParam = url.searchParams.get('hours')
    const since =
      hoursParam != null && /^\d+$/.test(hoursParam)
        ? new Date(now.getTime() - parseInt(hoursParam, 10) * 60 * 60 * 1000)
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))

    const hiredRecent = await prisma.rBTProfile.findMany({
      where: {
        status: 'HIRED',
        OR: [
          { updatedAt: { gte: since } },
          { createdAt: { gte: since } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        fortyHourCourseCompleted: true,
      },
    })

    const withEmail = hiredRecent.filter((p) => p.email)
    const results: { id: string; email: string; sent: boolean; error?: string }[] = []

    for (const profile of withEmail) {
      try {
        const { subject, html } = generateManualHireOnboardingEmail(
          {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
          },
          profile.fortyHourCourseCompleted === true
        )
        await sendEmail({
          to: profile.email!,
          subject,
          html,
          templateType: EmailTemplateType.OFFER,
          rbtProfileId: profile.id,
        })
        results.push({ id: profile.id, email: profile.email!, sent: true })
      } catch (e: any) {
        results.push({
          id: profile.id,
          email: profile.email!,
          sent: false,
          error: e?.message || String(e),
        })
      }
    }

    const withoutEmail = hiredRecent.filter((p) => !p.email)
    const windowLabel = hoursParam ? `last ${hoursParam} hour(s)` : 'today'
    return NextResponse.json({
      message: `Processed ${withEmail.length} RBT(s) hired ${windowLabel} with email; ${withoutEmail.length} had no email.`,
      window: hoursParam ? `last ${hoursParam} hours` : 'today',
      totalHiredInWindow: hiredRecent.length,
      withEmail: withEmail.length,
      withoutEmail: withoutEmail.length,
      results,
    })
  } catch (error: any) {
    console.error('send-hired-welcome-today error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to send hired welcome emails' },
      { status: 500 }
    )
  }
}

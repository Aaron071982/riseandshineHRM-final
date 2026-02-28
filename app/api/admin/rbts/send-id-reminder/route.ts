import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { sendGenericEmail, generateIdReminderEmail } from '@/lib/email'

/**
 * POST /api/admin/rbts/send-id-reminder
 * Sends an email to every hired RBT (with an email) asking them to email their ID to info@riseandshine.nyc
 */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const hired = await prisma.rBTProfile.findMany({
      where: { status: 'HIRED', email: { not: null } },
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    const results: { id: string; name: string; email: string; sent: boolean }[] = []
    for (const rbt of hired) {
      const email = rbt.email!.trim()
      const fullName = `${rbt.firstName} ${rbt.lastName}`.trim() || 'there'
      const { subject, html } = generateIdReminderEmail(fullName)
      const sent = await sendGenericEmail(email, subject, html)
      results.push({ id: rbt.id, name: fullName, email, sent })
    }

    const sentCount = results.filter((r) => r.sent).length
    return NextResponse.json({
      success: true,
      message: `ID reminder email sent to ${sentCount} of ${results.length} hired RBT(s).`,
      sent: sentCount,
      total: results.length,
      results,
    })
  } catch (error: unknown) {
    console.error('Send ID reminder error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send ID reminders' },
      { status: 500 }
    )
  }
}

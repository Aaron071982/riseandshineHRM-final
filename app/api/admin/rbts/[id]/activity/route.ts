import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

const PRESET_REASONS = new Set([
  'Back in school',
  'On break',
  'Personal',
  'Other',
])

/**
 * Set or clear RBT activityState (INACTIVE / ACTIVE).
 * Does NOT change pipeline status (HIRED stays HIRED). No emails.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const body = (await request.json().catch(() => ({}))) as {
      activityState?: 'ACTIVE' | 'INACTIVE'
      inactiveReason?: string | null
      inactiveUntil?: string | null
    }

    if (body.activityState !== 'ACTIVE' && body.activityState !== 'INACTIVE') {
      return NextResponse.json(
        { error: 'activityState must be ACTIVE or INACTIVE' },
        { status: 400 }
      )
    }

    const profile = await prisma.rBTProfile.findUnique({ where: { id } })
    if (!profile) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    const from = profile.activityState
    const to = body.activityState

    if (to === 'INACTIVE') {
      const reason = (body.inactiveReason || '').trim()
      if (!reason) {
        return NextResponse.json({ error: 'inactiveReason is required' }, { status: 400 })
      }
      const until = body.inactiveUntil ? new Date(body.inactiveUntil) : null
      if (until && Number.isNaN(until.getTime())) {
        return NextResponse.json({ error: 'invalid inactiveUntil' }, { status: 400 })
      }

      await prisma.rBTProfile.update({
        where: { id },
        data: {
          activityState: 'INACTIVE',
          inactiveReason: reason.slice(0, 500),
          inactiveUntil: until,
          inactiveSetByUserId: user?.id ?? null,
          inactiveSetAt: new Date(),
        },
      })

      await prisma.rBTAuditLog.create({
        data: {
          rbtProfileId: id,
          auditType: 'STATUS_CHANGE',
          dateTime: new Date(),
          notes: `Activity ${from} → INACTIVE. Reason: ${reason}.${until ? ` Until: ${until.toISOString()}` : ''} (employment status unchanged: ${profile.status})`,
          createdBy: user?.email || user?.name || 'Admin',
        },
      })
    } else {
      await prisma.rBTProfile.update({
        where: { id },
        data: {
          activityState: 'ACTIVE',
          inactiveReason: null,
          inactiveUntil: null,
          inactiveSetByUserId: user?.id ?? null,
          inactiveSetAt: new Date(),
        },
      })

      await prisma.rBTAuditLog.create({
        data: {
          rbtProfileId: id,
          auditType: 'STATUS_CHANGE',
          dateTime: new Date(),
          notes: `Activity ${from} → ACTIVE (reactivated). Employment status unchanged: ${profile.status}`,
          createdBy: user?.email || user?.name || 'Admin',
        },
      })
    }

    return NextResponse.json({
      success: true,
      activityState: to,
      presets: [...PRESET_REASONS],
    })
  } catch (error) {
    console.error('Error updating activity state:', error)
    return NextResponse.json(
      { error: 'Failed to update activity state' },
      { status: 500 }
    )
  }
}

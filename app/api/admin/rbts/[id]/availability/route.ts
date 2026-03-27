import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { validateAvailabilityJson, validateSlots } from '@/lib/rbt-availability-validation'

// GET: Admin can view any RBT's availability slots
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params // This is the RBTProfile ID
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    // Verify RBT profile exists and get slots
    let rbtProfile: { id: string; firstName: string; lastName: string; email: string | null; scheduleCompleted: boolean } | null = null
    let slots: Array<{ dayOfWeek: number; hour: number }> = []

    try {
      const profile = await prisma.rBTProfile.findUnique({
        where: { id },
        select: { id: true, firstName: true, lastName: true, email: true, scheduleCompleted: true },
      })
      if (profile) rbtProfile = profile

      if (rbtProfile) {
        try {
          const slotRows = await prisma.availabilitySlot.findMany({
            where: { rbtProfileId: id },
            orderBy: [{ dayOfWeek: 'asc' }, { hour: 'asc' }],
            select: { dayOfWeek: true, hour: true },
          })
          slots = slotRows
        } catch (slotErr: any) {
          if (slotErr.code === 'P2021' || slotErr.message?.includes('does not exist')) {
            console.warn('AvailabilitySlot table not found, returning empty slots')
          } else {
            throw slotErr
          }
        }
      }
    } catch (err) {
      console.error('Error fetching RBT availability (Prisma), trying raw SQL', err)
      try {
        const [profileRow] = await prisma.$queryRaw<
          Array<{ id: string; firstName: string; lastName: string; email: string | null; scheduleCompleted: boolean }>
        >`SELECT id, "firstName", "lastName", email, "scheduleCompleted" FROM rbt_profiles WHERE id = ${id}`
        if (profileRow) rbtProfile = profileRow
        const slotRows = await prisma.$queryRaw<Array<{ dayOfWeek: number; hour: number }>>`
          SELECT "dayOfWeek", hour FROM availability_slots WHERE "rbtProfileId" = ${id} ORDER BY "dayOfWeek", hour
        `.catch(() => [])
        slots = Array.isArray(slotRows) ? slotRows : []
      } catch (rawErr) {
        console.error('Error fetching RBT availability (raw)', rawErr)
        return NextResponse.json(
          { error: 'Failed to fetch RBT availability' },
          { status: 500 }
        )
      }
    }

    if (!rbtProfile) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      rbtProfile: {
        id: rbtProfile.id,
        firstName: rbtProfile.firstName,
        lastName: rbtProfile.lastName,
        email: rbtProfile.email,
        scheduleCompleted: rbtProfile.scheduleCompleted,
      },
      slots,
    })
  } catch (error) {
    console.error('Error fetching RBT availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RBT availability' },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Update RBT application-style availabilityJson, preferredHoursRange, and/or hourly availability_slots.
 * Body: { availabilityJson?: object, preferredHoursRange?: string | null, slots?: Array<{ dayOfWeek, hour }> }
 * At least one field must be present.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const adminUser = auth.user

    let body: {
      availabilityJson?: unknown
      preferredHoursRange?: string | null
      slots?: unknown
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const hasAvailabilityJson = 'availabilityJson' in body
    const hasPreferredHours = 'preferredHoursRange' in body
    const hasSlots = 'slots' in body

    if (!hasAvailabilityJson && !hasPreferredHours && !hasSlots) {
      return NextResponse.json(
        { error: 'Provide at least one of: availabilityJson, preferredHoursRange, slots' },
        { status: 400 }
      )
    }

    const existing = await prisma.rBTProfile.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    let parsedJson: Record<string, unknown> | undefined
    if (hasAvailabilityJson) {
      const v = validateAvailabilityJson(body.availabilityJson)
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
      parsedJson = {
        ...(v.value.weekday != null ? { weekday: v.value.weekday } : {}),
        ...(v.value.weekend != null ? { weekend: v.value.weekend } : {}),
        ...(v.value.earliestStartTime !== undefined
          ? { earliestStartTime: v.value.earliestStartTime }
          : {}),
        ...(v.value.latestEndTime !== undefined ? { latestEndTime: v.value.latestEndTime } : {}),
      }
    }

    let parsedSlots: Array<{ dayOfWeek: number; hour: number }> | undefined
    if (hasSlots) {
      const v = validateSlots(body.slots)
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
      parsedSlots = v.value
    }

    const preferredHoursRange =
      hasPreferredHours
        ? body.preferredHoursRange === null || body.preferredHoursRange === ''
          ? null
          : String(body.preferredHoursRange)
        : undefined

    const result = await prisma.$transaction(async (tx) => {
      const data: {
        availabilityJson?: object
        preferredHoursRange?: string | null
        scheduleCompleted?: boolean
      } = {}

      if (hasAvailabilityJson) {
        data.availabilityJson = parsedJson as object
      }
      if (hasPreferredHours) {
        data.preferredHoursRange = preferredHoursRange ?? null
      }
      if (hasSlots) {
        data.scheduleCompleted = (parsedSlots?.length ?? 0) > 0
      }

      const updated = await tx.rBTProfile.update({
        where: { id },
        data,
        select: {
          availabilityJson: true,
          preferredHoursRange: true,
          scheduleCompleted: true,
        },
      })

      if (hasSlots && parsedSlots) {
        await tx.availabilitySlot.deleteMany({ where: { rbtProfileId: id } })
        if (parsedSlots.length > 0) {
          await tx.availabilitySlot.createMany({
            data: parsedSlots.map((s) => ({
              rbtProfileId: id,
              dayOfWeek: s.dayOfWeek,
              hour: s.hour,
            })),
          })
        }
      }

      const slotRows = await tx.availabilitySlot.findMany({
        where: { rbtProfileId: id },
        orderBy: [{ dayOfWeek: 'asc' }, { hour: 'asc' }],
        select: { dayOfWeek: true, hour: true },
      })

      await tx.rBTAuditLog.create({
        data: {
          rbtProfileId: id,
          auditType: 'NOTE',
          dateTime: new Date(),
          notes: `Admin updated availability/schedule (${[hasAvailabilityJson && 'json', hasPreferredHours && 'hours', hasSlots && 'slots'].filter(Boolean).join(', ')})`,
          createdBy: adminUser?.email || adminUser?.name || 'Admin',
        },
      })

      return { updated, slots: slotRows }
    })

    return NextResponse.json({
      availabilityJson: result.updated.availabilityJson,
      preferredHoursRange: result.updated.preferredHoursRange,
      scheduleCompleted: result.updated.scheduleCompleted,
      slots: result.slots,
    })
  } catch (error: unknown) {
    console.error('PATCH /api/admin/rbts/[id]/availability:', error)
    const msg = error instanceof Error ? error.message : 'Failed to update availability'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


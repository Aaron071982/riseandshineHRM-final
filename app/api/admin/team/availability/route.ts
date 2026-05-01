import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type AvailabilityRange = {
  dayOfWeek: number
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
  label?: string | null
  color?: string | null
  isActive?: boolean
}

const DEFAULT_COLOR = '#F97316'

function isValidMinute(value: number) {
  return value === 0 || value === 30
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const rows = Array.isArray(body.availability) ? (body.availability as AvailabilityRange[]) : []

  const cleaned = rows
    .map((r) => ({
      dayOfWeek: Number(r.dayOfWeek),
      startHour: Number(r.startHour),
      startMinute: Number(r.startMinute),
      endHour: Number(r.endHour),
      endMinute: Number(r.endMinute),
      label: typeof r.label === 'string' ? r.label.trim().slice(0, 80) : null,
      color: typeof r.color === 'string' && r.color.trim() ? r.color.trim() : DEFAULT_COLOR,
      isActive: r.isActive !== false,
    }))
    .filter((r) => {
      if (r.dayOfWeek < 0 || r.dayOfWeek > 6) return false
      if (r.startHour < 0 || r.startHour > 23 || r.endHour < 0 || r.endHour > 23) return false
      if (!isValidMinute(r.startMinute) || !isValidMinute(r.endMinute)) return false
      if (r.startHour > r.endHour) return false
      if (r.startHour === r.endHour && r.startMinute >= r.endMinute) return false
      return true
    })

  const prismaAny = prisma as unknown as {
    $transaction: (fn: (tx: {
      adminAvailability?: { deleteMany: (args: unknown) => Promise<unknown>; createMany: (args: unknown) => Promise<unknown> }
      interviewerAvailability?: { deleteMany: (args: unknown) => Promise<unknown>; createMany: (args: unknown) => Promise<unknown> }
    }) => Promise<void>) => Promise<void>
  }

  await prismaAny.$transaction(async (tx) => {
    if (tx.adminAvailability?.deleteMany && tx.adminAvailability?.createMany) {
      await tx.adminAvailability.deleteMany({ where: { userId: auth.user.id } })
      if (cleaned.length > 0) {
        await tx.adminAvailability.createMany({
          data: cleaned.map((r) => ({
            userId: auth.user.id,
            dayOfWeek: r.dayOfWeek,
            startHour: r.startHour,
            startMinute: r.startMinute,
            endHour: r.endHour,
            endMinute: r.endMinute,
            label: r.label || null,
            color: r.color,
            isActive: r.isActive,
          })),
        })
      }
      return
    }

    // Fallback: use existing "My Availability" source so Team Hub always works.
    if (tx.interviewerAvailability?.deleteMany && tx.interviewerAvailability?.createMany) {
      await tx.interviewerAvailability.deleteMany({ where: { userId: auth.user.id } })
      if (cleaned.length > 0) {
        await tx.interviewerAvailability.createMany({
          data: cleaned.map((r) => ({
            userId: auth.user.id,
            dayOfWeek: r.dayOfWeek,
            startHour: r.startHour,
            startMinute: r.startMinute,
            endHour: r.endHour,
            endMinute: r.endMinute,
            isActive: r.isActive,
          })),
        })
      }
    }
  })

  return NextResponse.json({ success: true })
}

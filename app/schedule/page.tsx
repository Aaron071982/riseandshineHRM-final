import { prisma } from '@/lib/prisma'
import ScheduleWorkspace from '@/components/schedule/ScheduleWorkspace'

export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  const [therapists, clients, slots, allowedUsers] = await Promise.all([
    prisma.scheduleTherapist.findMany({ orderBy: { name: 'asc' } }),
    prisma.scheduleWeeklyClient.findMany({ orderBy: { name: 'asc' } }),
    prisma.scheduleSessionSlot.findMany(),
    prisma.scheduleAllowedUser.findMany({ orderBy: { email: 'asc' } }),
  ])

  const initial = {
    therapists: therapists.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      role: t.role,
      colorKey: t.colorKey,
      active: t.active,
    })),
    clients: clients.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      insurance: c.insurance,
      bcba: c.bcba,
      authorizedHoursPerWeek:
        c.authorizedHoursPerWeek != null ? Number(c.authorizedHoursPerWeek) : null,
      active: c.active,
    })),
    slots: slots.map((s) => ({
      id: s.id,
      therapistId: s.therapistId,
      clientId: s.clientId,
      day: s.day,
      startMin: s.startMin,
      endMin: s.endMin,
      status: s.status,
      procedureCode: s.procedureCode,
      placeOfService: s.placeOfService,
      note: s.note,
      createdBy: s.createdBy,
      updatedBy: s.updatedBy,
    })),
    allowedEmails: allowedUsers.map((u) => u.email),
    allowedUsers: allowedUsers.map((u) => ({ id: u.id, email: u.email })),
  }

  return <ScheduleWorkspace initial={initial} />
}

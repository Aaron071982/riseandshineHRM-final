import { differenceInDays, format } from 'date-fns'
import { prisma } from '@/lib/prisma'

const DAY_MS = 24 * 60 * 60 * 1000

export async function getHireDateProxy(rbtProfileId: string, fallback: Date): Promise<Date> {
  const hireLog = await prisma.rBTAuditLog.findFirst({
    where: {
      rbtProfileId,
      auditType: 'STATUS_CHANGE',
      notes: { contains: 'HIRED', mode: 'insensitive' },
    },
    orderBy: { dateTime: 'asc' },
    select: { dateTime: true },
  })
  return hireLog?.dateTime ?? fallback
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return format(d, 'yyyy-MM-dd')
}

export function daysSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / DAY_MS)
}

export function daysBetween(from: Date, to: Date = new Date()): number {
  return differenceInDays(to, from)
}

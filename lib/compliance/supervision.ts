import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

const DEFAULT_SUPERVISION_PERCENT = 5

type CompanyConfigMap = Map<string, unknown>

async function getCompanyConfig(): Promise<CompanyConfigMap> {
  const settings = await prisma.companySetting.findMany()
  const map = new Map<string, unknown>()
  for (const s of settings) {
    map.set(s.key, s.value)
  }
  return map
}

function getNumberConfig(config: CompanyConfigMap, key: string, fallback: number): number {
  const raw = config.get(key)
  if (raw == null) return fallback
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : fallback
  }
  if (typeof raw === 'string') {
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  return fallback
}

export async function runSupervisionComplianceEngine(referenceDate = new Date()) {
  const config = await getCompanyConfig()
  const supervisionPercent = getNumberConfig(
    config,
    'supervision.required_percent',
    DEFAULT_SUPERVISION_PERCENT,
  )

  const year = referenceDate.getUTCFullYear()
  const month = referenceDate.getUTCMonth()

  const monthStart = new Date(Date.UTC(year, month, 1))
  const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))

  const rbts = await prisma.employee.findMany({
    where: {
      employeeType: 'RBT',
    },
    select: { id: true },
  })

  for (const rbt of rbts) {
    const [directMinutesAgg, supervisionMinutesAgg] = await Promise.all([
      prisma.clinicalServiceLog.aggregate({
        _sum: { minutes: true },
        where: {
          employeeId: rbt.id,
          isBillable: true,
          serviceDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),
      prisma.supervisionEvent.aggregate({
        _sum: { minutes: true },
        where: {
          rbtEmployeeId: rbt.id,
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),
    ])

    const totalDirectMinutes = directMinutesAgg._sum.minutes ?? 0
    const supervisionMinutes = supervisionMinutesAgg._sum.minutes ?? 0

    if (totalDirectMinutes <= 0) {
      continue
    }

    const supervisionRatio = (supervisionMinutes / totalDirectMinutes) * 100
    const requiredRatio = supervisionPercent

    if (supervisionRatio + 1e-6 < requiredRatio) {
      const severity: 'WARN' | 'BLOCKER' =
        referenceDate > monthEnd ? 'BLOCKER' : 'WARN'

      const message = `Supervision minutes ${supervisionMinutes} are below required ${requiredRatio}% of direct service minutes ${totalDirectMinutes} for this month.`

      const existing = await prisma.complianceAlert.findFirst({
        where: {
          employeeId: rbt.id,
          alertType: 'UNDER_SUPERVISION_5_PERCENT',
          resolvedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!existing) {
        const created = await prisma.complianceAlert.create({
          data: {
            employeeId: rbt.id,
            alertType: 'UNDER_SUPERVISION_5_PERCENT',
            severity,
            message,
            dueAt: monthEnd,
          },
        })

        await writeAuditLog({
          actorUserId: null,
          entityType: 'ComplianceAlert',
          entityId: created.id,
          action: 'CREATE',
          before: null,
          after: {
            employeeId: created.employeeId,
            severity: created.severity,
            message: created.message,
            dueAt: created.dueAt,
          },
        })
      } else {
        const before = {
          severity: existing.severity,
          message: existing.message,
          dueAt: existing.dueAt,
        }

        const updated = await prisma.complianceAlert.update({
          where: { id: existing.id },
          data: {
            severity,
            message,
            dueAt: monthEnd,
          },
        })

        await writeAuditLog({
          actorUserId: null,
          entityType: 'ComplianceAlert',
          entityId: updated.id,
          action: 'UPDATE',
          before,
          after: {
            severity: updated.severity,
            message: updated.message,
            dueAt: updated.dueAt,
          },
        })
      }
    }
  }
}


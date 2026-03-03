import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'

const DEFAULT_EXPIRATION_DAYS_WARN = 60
const DEFAULT_EXPIRATION_DAYS_BLOCKER = 7

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

export async function runExpirationEngine(now = new Date()) {
  const config = await getCompanyConfig()

  const warnDays = getNumberConfig(config, 'expiration.warn_days', DEFAULT_EXPIRATION_DAYS_WARN)
  const blockerDays = getNumberConfig(config, 'expiration.blocker_days', DEFAULT_EXPIRATION_DAYS_BLOCKER)

  const today = new Date(now.toISOString().slice(0, 10))

  const warnThreshold = new Date(today)
  warnThreshold.setDate(warnThreshold.getDate() + warnDays)

  const blockerThreshold = new Date(today)
  blockerThreshold.setDate(blockerThreshold.getDate() + blockerDays)

  await prisma.$transaction(async (tx) => {
    await handleDocumentAndCredentialExpirations(tx, warnThreshold, blockerThreshold, today)
    await handlePayerAuthorizationExpirations(tx, warnThreshold, blockerThreshold, today)
  })
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function handleDocumentAndCredentialExpirations(
  tx: TxClient,
  warnThreshold: Date,
  blockerThreshold: Date,
  today: Date,
) {
  const documents = await tx.employmentDocument.findMany({
    where: {
      expiresAt: {
        not: null,
        lte: warnThreshold,
      },
    },
  })

  for (const doc of documents) {
    const expiresAt = doc.expiresAt!
    let severity: 'INFO' | 'WARN' | 'BLOCKER' = 'WARN'
    if (expiresAt <= today) {
      severity = 'BLOCKER'
    } else if (expiresAt <= blockerThreshold) {
      severity = 'BLOCKER'
    } else {
      severity = 'WARN'
    }

    if (expiresAt <= today && doc.status !== 'EXPIRED') {
      await tx.employmentDocument.update({
        where: { id: doc.id },
        data: { status: 'EXPIRED' },
      })
    }

    await upsertComplianceAlert(tx, {
      employeeId: doc.employeeId,
      alertType: 'DOC_EXPIRING',
      severity,
      message: `Document ${doc.docType} expires on ${expiresAt.toISOString().slice(0, 10)}`,
      dueAt: expiresAt,
    })
  }

  const credentials = await tx.credential.findMany({
    where: {
      expiresAt: {
        not: null,
        lte: warnThreshold,
      },
    },
  })

  for (const cred of credentials) {
    const expiresAt = cred.expiresAt!
    let severity: 'INFO' | 'WARN' | 'BLOCKER' = 'WARN'
    if (expiresAt <= today) {
      severity = 'BLOCKER'
    } else if (expiresAt <= blockerThreshold) {
      severity = 'BLOCKER'
    } else {
      severity = 'WARN'
    }

    if (expiresAt <= today && cred.verificationStatus !== 'EXPIRED') {
      // Do not change verification_status enum here; expiry is captured via alerts.
    }

    await upsertComplianceAlert(tx, {
      employeeId: cred.employeeId,
      alertType: 'CREDENTIAL_EXPIRING',
      severity,
      message: `Credential ${cred.credentialType} expires on ${expiresAt.toISOString().slice(0, 10)}`,
      dueAt: expiresAt,
    })
  }
}

async function handlePayerAuthorizationExpirations(
  tx: TxClient,
  warnThreshold: Date,
  blockerThreshold: Date,
  today: Date,
) {
  const auths = await tx.payerAuthorization.findMany({
    where: {
      OR: [
        {
          endDate: {
            not: null,
            lte: warnThreshold,
          },
        },
        {
          unitsAuthorized: {
            not: null,
          },
          unitsUsed: {
            not: null,
          },
        },
      ],
    },
    include: {
      client: true,
    },
  })

  for (const auth of auths) {
    const clientName = auth.client?.name ?? 'Client'

    if (auth.endDate) {
      const endDate = auth.endDate
      let severity: 'INFO' | 'WARN' | 'BLOCKER' = 'WARN'
      if (endDate <= today) {
        severity = 'BLOCKER'
      } else if (endDate <= blockerThreshold) {
        severity = 'BLOCKER'
      } else {
        severity = 'WARN'
      }

      await upsertComplianceAlert(tx, {
        employeeId: null,
        alertType: 'AUTH_EXPIRING',
        severity,
        message: `Authorization ${auth.authNumber} for ${clientName} expires on ${endDate
          .toISOString()
          .slice(0, 10)}`,
        dueAt: endDate,
      })

      if (endDate <= today && auth.status !== 'EXPIRED') {
        await tx.payerAuthorization.update({
          where: { id: auth.id },
          data: { status: 'EXPIRED' },
        })
      }
    }

    if (auth.unitsAuthorized != null && auth.unitsUsed != null) {
      if (auth.unitsUsed >= auth.unitsAuthorized && auth.status !== 'EXHAUSTED') {
        await tx.payerAuthorization.update({
          where: { id: auth.id },
          data: { status: 'EXHAUSTED' },
        })

        await upsertComplianceAlert(tx, {
          employeeId: null,
          alertType: 'AUTH_EXHAUSTED',
          severity: 'BLOCKER',
          message: `Authorization ${auth.authNumber} for ${clientName} is exhausted (${auth.unitsUsed}/${auth.unitsAuthorized} units)`,
          dueAt: today,
        })
      }
    }
  }
}

interface UpsertAlertParams {
  employeeId: string | null
  alertType:
    | 'DOC_EXPIRING'
    | 'CREDENTIAL_EXPIRING'
    | 'UNDER_SUPERVISION_5_PERCENT'
    | 'AUTH_EXPIRING'
    | 'AUTH_EXHAUSTED'
  severity: 'INFO' | 'WARN' | 'BLOCKER'
  message: string
  dueAt?: Date | null
}

async function upsertComplianceAlert(tx: TxClient, params: UpsertAlertParams) {
  const { employeeId, alertType, severity, message, dueAt } = params

  const existing = await tx.complianceAlert.findFirst({
    where: {
      employeeId,
      alertType,
      resolvedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!existing) {
    await tx.complianceAlert.create({
      data: {
        employeeId,
        alertType,
        severity,
        message,
        dueAt: dueAt ?? null,
      },
    })
    return
  }

  const before = { severity: existing.severity, message: existing.message, dueAt: existing.dueAt }

  const updated = await tx.complianceAlert.update({
    where: { id: existing.id },
    data: {
      severity,
      message,
      dueAt: dueAt ?? existing.dueAt,
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


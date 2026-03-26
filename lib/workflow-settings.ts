import { prisma } from './prisma'

export const WORKFLOW_KEYS = {
  EMAIL_REACH_OUT: 'workflow_email_reach_out',
  EMAIL_TO_INTERVIEW: 'workflow_email_to_interview',
  EMAIL_HIRED: 'workflow_email_hired',
  EMAIL_REJECTION: 'workflow_email_rejection',
  NOTIFY_ADMINS_HIRED: 'workflow_notify_admins_hired',
  STALENESS_DIGEST: 'workflow_staleness_digest',
  STALENESS_DAYS_REACH_OUT: 'workflow_staleness_days_reach_out',
  STALENESS_DAYS_TO_INTERVIEW: 'workflow_staleness_days_to_interview',
  STALENESS_DAYS_ONBOARDING: 'workflow_staleness_days_onboarding',
  STALENESS_RECIPIENTS: 'workflow_staleness_recipients',
} as const

export interface WorkflowSettings {
  emailReachOut: boolean
  emailToInterview: boolean
  emailHired: boolean
  emailRejection: boolean
  notifyAdminsHired: boolean
  stalenessDigest: boolean
  stalenessDaysReachOut: number
  stalenessDaysToInterview: number
  stalenessDaysOnboarding: number
  stalenessRecipients: string[]
}

const DEFAULTS: WorkflowSettings = {
  emailReachOut: true,
  emailToInterview: true,
  emailHired: true,
  emailRejection: true,
  notifyAdminsHired: true,
  stalenessDigest: true,
  stalenessDaysReachOut: 7,
  stalenessDaysToInterview: 5,
  stalenessDaysOnboarding: 3,
  stalenessRecipients: [],
}

function parseBool(val: unknown): boolean {
  if (val === true || val === false) return val
  if (val === 'true') return true
  if (val === 'false') return false
  return true
}

function parseNumber(val: unknown, fallback: number): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return Math.max(1, val)
  if (typeof val === 'string') {
    const n = parseInt(val, 10)
    if (!Number.isNaN(n)) return Math.max(1, n)
  }
  return fallback
}

function parseStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.filter((e): e is string => typeof e === 'string' && e.trim().length > 0).map((e) => e.trim().toLowerCase())
  }
  if (typeof val === 'string') {
    return val
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  }
  return []
}

export async function getWorkflowSettings(): Promise<WorkflowSettings> {
  try {
    const rows = await prisma.companySetting.findMany({
      where: {
        key: {
          in: Object.values(WORKFLOW_KEYS),
        },
      },
    })
    const map = new Map(rows.map((r) => [r.key, r.value]))

    return {
      emailReachOut: parseBool(map.get(WORKFLOW_KEYS.EMAIL_REACH_OUT)),
      emailToInterview: parseBool(map.get(WORKFLOW_KEYS.EMAIL_TO_INTERVIEW)),
      emailHired: parseBool(map.get(WORKFLOW_KEYS.EMAIL_HIRED)),
      emailRejection: parseBool(map.get(WORKFLOW_KEYS.EMAIL_REJECTION)),
      notifyAdminsHired: parseBool(map.get(WORKFLOW_KEYS.NOTIFY_ADMINS_HIRED)),
      stalenessDigest: parseBool(map.get(WORKFLOW_KEYS.STALENESS_DIGEST)),
      stalenessDaysReachOut: parseNumber(map.get(WORKFLOW_KEYS.STALENESS_DAYS_REACH_OUT), DEFAULTS.stalenessDaysReachOut),
      stalenessDaysToInterview: parseNumber(map.get(WORKFLOW_KEYS.STALENESS_DAYS_TO_INTERVIEW), DEFAULTS.stalenessDaysToInterview),
      stalenessDaysOnboarding: parseNumber(map.get(WORKFLOW_KEYS.STALENESS_DAYS_ONBOARDING), DEFAULTS.stalenessDaysOnboarding),
      stalenessRecipients: parseStringArray(map.get(WORKFLOW_KEYS.STALENESS_RECIPIENTS)),
    }
  } catch (err) {
    console.error('[workflow-settings] getWorkflowSettings failed, returning defaults:', err)
    return { ...DEFAULTS }
  }
}

export async function setWorkflowSettings(settings: Partial<WorkflowSettings>): Promise<void> {
  const updates: Array<{ key: string; value: unknown }> = []
  if (settings.emailReachOut !== undefined) updates.push({ key: WORKFLOW_KEYS.EMAIL_REACH_OUT, value: settings.emailReachOut })
  if (settings.emailToInterview !== undefined) updates.push({ key: WORKFLOW_KEYS.EMAIL_TO_INTERVIEW, value: settings.emailToInterview })
  if (settings.emailHired !== undefined) updates.push({ key: WORKFLOW_KEYS.EMAIL_HIRED, value: settings.emailHired })
  if (settings.emailRejection !== undefined) updates.push({ key: WORKFLOW_KEYS.EMAIL_REJECTION, value: settings.emailRejection })
  if (settings.notifyAdminsHired !== undefined) updates.push({ key: WORKFLOW_KEYS.NOTIFY_ADMINS_HIRED, value: settings.notifyAdminsHired })
  if (settings.stalenessDigest !== undefined) updates.push({ key: WORKFLOW_KEYS.STALENESS_DIGEST, value: settings.stalenessDigest })
  if (settings.stalenessDaysReachOut !== undefined) updates.push({ key: WORKFLOW_KEYS.STALENESS_DAYS_REACH_OUT, value: settings.stalenessDaysReachOut })
  if (settings.stalenessDaysToInterview !== undefined) updates.push({ key: WORKFLOW_KEYS.STALENESS_DAYS_TO_INTERVIEW, value: settings.stalenessDaysToInterview })
  if (settings.stalenessDaysOnboarding !== undefined) updates.push({ key: WORKFLOW_KEYS.STALENESS_DAYS_ONBOARDING, value: settings.stalenessDaysOnboarding })
  if (settings.stalenessRecipients !== undefined) updates.push({ key: WORKFLOW_KEYS.STALENESS_RECIPIENTS, value: settings.stalenessRecipients })

  for (const { key, value } of updates) {
    await prisma.companySetting.upsert({
      where: { key },
      create: { key, value: value as any },
      update: { value: value as any },
    })
  }
}

export { DEFAULTS as WORKFLOW_DEFAULTS }

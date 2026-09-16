import { NextResponse } from 'next/server'
import {
  isBillingManager,
  requireBillingManagerSession,
  type SessionUser,
} from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

export class PayrollAccessError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.name = 'PayrollAccessError'
    this.status = status
  }
}

/** Server actions / libs: throw 403 unless billing manager (includes SUPER_ADMIN emails). */
export async function assertCanWritePayroll(): Promise<SessionUser> {
  const auth = await requireBillingManagerSession()
  if (auth.response || !auth.user) {
    throw new PayrollAccessError(
      'Payroll access required (billing manager or super-admin)',
      auth.response?.status === 401 ? 401 : 403
    )
  }
  return auth.user
}

export function assertIsPayrollWriter(user: SessionUser | null): asserts user is SessionUser {
  if (!isBillingManager(user)) {
    throw new PayrollAccessError(
      'Payroll access required (billing manager or super-admin)',
      403
    )
  }
}

export async function requirePayrollApiSession(): Promise<
  | { user: SessionUser; response: null }
  | { user: null; response: NextResponse }
> {
  return requireBillingManagerSession()
}

export async function auditPayrollChange(input: {
  actorUserId: string
  entityType: string
  entityId: string
  /** e.g. PAYROLL_RATE_CHANGE:105→110 */
  label: string
  before?: unknown
  after?: unknown
}): Promise<void> {
  await writeAuditLog({
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: 'UPDATE',
    before: input.before ?? null,
    after: { auditAction: input.label, ...(input.after as object) },
  })
}

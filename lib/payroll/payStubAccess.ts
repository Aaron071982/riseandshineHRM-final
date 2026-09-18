import 'server-only'

import { isBillingManager, type SessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type PayStubAccess =
  | { ok: true; role: 'admin' | 'owner' }
  | { ok: false; status: 401 | 403 | 404; error: string }

/**
 * App-layer ownership for pay stub PII.
 * - Billing managers / super-admins: any statement
 * - BCBA contractor: own SENT BCBA statements (portal)
 * - RBT employee: own SENT RBT statements (RBT portal Pay page)
 */
export async function assertCanAccessPayStatement(input: {
  user: SessionUser | null
  statementId: string
  /** When true, only SENT statements are visible to owners (portal). Admins always ok. */
  requireSentForOwner?: boolean
}): Promise<PayStubAccess> {
  if (!input.user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const statement = await prisma.payStatement.findUnique({
    where: { id: input.statementId },
    select: {
      id: true,
      status: true,
      payeeType: true,
      contractorId: true,
      staffId: true,
      pdfUrl: true,
      contractor: { select: { userId: true } },
      rbtProfile: { select: { userId: true } },
    },
  })

  if (!statement) {
    return { ok: false, status: 404, error: 'Pay statement not found' }
  }

  if (isBillingManager(input.user)) {
    return { ok: true, role: 'admin' }
  }

  const ownerUserId =
    statement.payeeType === 'BCBA'
      ? statement.contractor?.userId
      : statement.rbtProfile?.userId

  if (!ownerUserId || ownerUserId !== input.user.id) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  if (input.requireSentForOwner && statement.status !== 'SENT') {
    return { ok: false, status: 403, error: 'Statement not published' }
  }

  return { ok: true, role: 'owner' }
}

import type { Prisma } from '@prisma/client'
import { startOfDay } from 'date-fns'

/** Active CRM RBT assignment: status ACTIVE and endDate null or future. */
export function activeCrmRbtAssignmentWhere(at = new Date()): Prisma.ClientRbtAssignmentWhereInput {
  const d = startOfDay(at)
  return {
    status: 'ACTIVE',
    OR: [{ endDate: null }, { endDate: { gte: d } }],
  }
}

export function activeCrmBcbaAssignmentWhere(at = new Date()): Prisma.ClientBcbaAssignmentWhereInput {
  const d = startOfDay(at)
  return {
    status: 'ACTIVE',
    OR: [{ endDate: null }, { endDate: { gte: d } }],
  }
}

import { describe, expect, it } from 'vitest'
import { CrmAccessError } from '@/lib/crm/access'
import type { CrmRole } from '@prisma/client'
import {
  assertScheduleClientEdit,
  assertScheduleClientsEdit,
} from '@/lib/schedule/clientScope'

const fullAccess = {
  id: 'u-full',
  phoneNumber: null,
  role: 'ADMIN' as const,
  email: 'owner@test',
  crmRoles: ['MANAGEMENT'] as CrmRole[],
  fullAccess: true,
  superAdmin: false,
}

const intakeOnly = {
  id: 'u-intake',
  phoneNumber: null,
  role: 'CALL_CENTER' as const,
  email: 'intake@test',
  crmRoles: ['INTAKE'] as CrmRole[],
  fullAccess: false,
  superAdmin: false,
}

describe('lib/schedule/clientScope', () => {
  it('allows full-access to edit unlinked schedule clients', async () => {
    await expect(assertScheduleClientEdit(fullAccess, null)).resolves.toBeUndefined()
  })

  it('denies non-full-access on unlinked schedule clients', async () => {
    await expect(assertScheduleClientEdit(intakeOnly, null)).rejects.toBeInstanceOf(
      CrmAccessError
    )
  })

  it('denies non-full-access bulk edit when any row is unlinked', async () => {
    await expect(assertScheduleClientsEdit(intakeOnly, [null])).rejects.toBeInstanceOf(
      CrmAccessError
    )
  })
})

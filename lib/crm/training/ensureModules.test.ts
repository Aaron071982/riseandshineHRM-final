import { describe, expect, it } from 'vitest'
import { trainingRolesForUser } from './ensureModules'

describe('trainingRolesForUser', () => {
  it('maps SUPER_ADMIN to MANAGEMENT training module', () => {
    expect(trainingRolesForUser(['SUPER_ADMIN'])).toEqual(['MANAGEMENT'])
  })

  it('keeps known department roles', () => {
    expect(trainingRolesForUser(['INTAKE', 'BILLING'])).toEqual(
      expect.arrayContaining(['INTAKE', 'BILLING'])
    )
  })
})

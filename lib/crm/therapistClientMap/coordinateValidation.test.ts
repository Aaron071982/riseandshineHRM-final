import { describe, expect, it } from 'vitest'
import { validateMapCoordinates } from '@/lib/crm/therapistClientMap/coordinateValidation'

describe('validateMapCoordinates', () => {
  it('accepts NYC coordinates when address state is NY', () => {
    expect(validateMapCoordinates(40.7128, -74.006, 'NY')).toEqual({
      valid: true,
    })
  })

  it('rejects coordinates outside the address state', () => {
    const result = validateMapCoordinates(25.7617, -80.1918, 'NY')
    expect(result.valid).toBe(false)
  })

  it('rejects coordinates outside the coverage area when state is unknown', () => {
    const result = validateMapCoordinates(41.8781, -87.6298, null)
    expect(result.valid).toBe(false)
  })

  it('accepts coordinates in coverage area when state is unknown', () => {
    expect(validateMapCoordinates(40.7128, -74.006, null)).toEqual({
      valid: true,
    })
  })
})

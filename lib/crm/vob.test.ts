import { describe, expect, it } from 'vitest'
import {
  authRequiredFromVobOutcome,
  isPaStepAutoSatisfied,
  parseVobOutcome,
} from './vob'

describe('authRequiredFromVobOutcome', () => {
  it('defaults to true when outcome missing or PA required', () => {
    expect(authRequiredFromVobOutcome(null)).toBe(true)
    expect(authRequiredFromVobOutcome('')).toBe(true)
    expect(authRequiredFromVobOutcome('PA_REQUIRED')).toBe(true)
    expect(authRequiredFromVobOutcome('unknown')).toBe(true)
  })

  it('is false only for NO_PA_REQUIRED', () => {
    expect(authRequiredFromVobOutcome('NO_PA_REQUIRED')).toBe(false)
  })
})

describe('parseVobOutcome', () => {
  it('accepts canonical outcomes only', () => {
    expect(parseVobOutcome('PA_REQUIRED')).toBe('PA_REQUIRED')
    expect(parseVobOutcome('no_pa_required')).toBe('NO_PA_REQUIRED')
    expect(parseVobOutcome('other')).toBeNull()
  })
})

describe('isPaStepAutoSatisfied', () => {
  it('auto-satisfies when auth not required', () => {
    expect(isPaStepAutoSatisfied(false)).toBe(true)
    expect(isPaStepAutoSatisfied(true)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { isElevatedSessionExpired } from './sessionExpiry'

const HOUR = 60 * 60 * 1000
const IDLE = HOUR
const ABSOLUTE = 12 * HOUR

describe('Client Services idle session expiry', () => {
  const base = {
    createdAtMs: 0,
    expiresAtMs: ABSOLUTE,
    idleMs: IDLE,
    absoluteMs: ABSOLUTE,
  }

  it('stays valid when last active within the idle window', () => {
    expect(
      isElevatedSessionExpired({
        ...base,
        nowMs: 30 * 60 * 1000,
        lastActiveAtMs: 0,
      })
    ).toBe(false)
  })

  it('expires after 1h idle even if absolute cap remains', () => {
    expect(
      isElevatedSessionExpired({
        ...base,
        nowMs: IDLE,
        lastActiveAtMs: 0,
      })
    ).toBe(true)
  })

  it('slides when lastActiveAt is bumped', () => {
    expect(
      isElevatedSessionExpired({
        ...base,
        nowMs: 90 * 60 * 1000,
        lastActiveAtMs: 50 * 60 * 1000,
      })
    ).toBe(false)
  })

  it('expires at absolute cap even with recent activity', () => {
    expect(
      isElevatedSessionExpired({
        ...base,
        nowMs: ABSOLUTE,
        lastActiveAtMs: ABSOLUTE - 1000,
      })
    ).toBe(true)
  })
})

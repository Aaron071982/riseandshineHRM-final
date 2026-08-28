import { describe, expect, it } from 'vitest'
import { requireDestructiveConfirm } from './serverConfirm'
import { CrmAccessError } from '@/lib/crm/access'

describe('lib/crm/serverConfirm', () => {
  it('accepts confirmed: true', () => {
    expect(() => requireDestructiveConfirm(true)).not.toThrow()
  })

  it('rejects missing confirmation', () => {
    expect(() => requireDestructiveConfirm(undefined)).toThrow(CrmAccessError)
    expect(() => requireDestructiveConfirm(false)).toThrow(CrmAccessError)
  })
})

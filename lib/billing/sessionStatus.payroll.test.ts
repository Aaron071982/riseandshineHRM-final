import { describe, expect, it } from 'vitest'
import {
  isRbtPayrollPayableSession,
  RBT_PAYROLL_PAYABLE_STATUSES,
} from '@/lib/billing/sessionStatus'

describe('isRbtPayrollPayableSession', () => {
  it('pays complete, ready_to_bill, in_progress, incomplete', () => {
    expect(isRbtPayrollPayableSession('completed')).toBe(true)
    expect(isRbtPayrollPayableSession('Ready to Bill')).toBe(true)
    expect(isRbtPayrollPayableSession('in_progress')).toBe(true)
    expect(isRbtPayrollPayableSession('Incomplete')).toBe(true)
    expect(RBT_PAYROLL_PAYABLE_STATUSES).toHaveLength(4)
  })

  it('never pays scheduled-only or cancelled/deleted', () => {
    expect(isRbtPayrollPayableSession('scheduled')).toBe(false)
    expect(isRbtPayrollPayableSession('Scheduled')).toBe(false)
    expect(isRbtPayrollPayableSession('cancelled')).toBe(false)
    expect(isRbtPayrollPayableSession('deleted')).toBe(false)
    expect(isRbtPayrollPayableSession(null)).toBe(false)
  })
})

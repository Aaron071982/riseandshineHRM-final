import { describe, expect, it } from 'vitest'
import {
  derivePortalLifecycle,
  isPortalCoordinationStage,
  isPortalReadyForAssessment,
} from '@/lib/crm/portalLifecycle'

describe('portalLifecycle', () => {
  it('marks assigned when BCBA id present', () => {
    const snap = derivePortalLifecycle({
      assignedBcbaId: 'u1',
      stage: 'INQUIRY',
      hasTherapistAssigned: false,
    })
    expect(snap.stages[0]?.done).toBe(true)
    expect(snap.currentId).toBe('THERAPIST_ASSIGNED')
  })

  it('detects coordination and ready stages from CRM stage', () => {
    expect(isPortalCoordinationStage('SCHEDULE_COORDINATION')).toBe(true)
    expect(isPortalReadyForAssessment('ASSESSMENT')).toBe(true)
    expect(isPortalReadyForAssessment('INQUIRY')).toBe(false)
  })

  it('fills therapist when care team present', () => {
    const snap = derivePortalLifecycle({
      assignedBcbaId: 'u1',
      stage: 'RBT_ASSIGNED',
      hasTherapistAssigned: true,
    })
    expect(snap.stages[1]?.done).toBe(true)
  })
})

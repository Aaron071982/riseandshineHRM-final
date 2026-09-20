import { describe, expect, it } from 'vitest'
import {
  derivePortalLifecycle,
  isPortalAuthorizationDone,
  isPortalIntakeDone,
  isPortalReadyForAssessment,
} from '@/lib/crm/portalLifecycle'

describe('portalLifecycle', () => {
  it('starts on Intake while CRM is still in intake', () => {
    const snap = derivePortalLifecycle({ stage: 'INQUIRY' })
    expect(snap.currentId).toBe('INTAKE')
    expect(snap.stages[0]?.done).toBe(false)
    expect(isPortalIntakeDone('INQUIRY')).toBe(false)
  })

  it('moves to Ready for assessment on ASSESSMENT', () => {
    const snap = derivePortalLifecycle({ stage: 'ASSESSMENT' })
    expect(isPortalIntakeDone('ASSESSMENT')).toBe(true)
    expect(isPortalAuthorizationDone('ASSESSMENT')).toBe(true)
    expect(isPortalReadyForAssessment('ASSESSMENT')).toBe(true)
    expect(snap.currentId).toBe('READY_FOR_ASSESSMENT')
    expect(snap.stages[2]?.done).toBe(false)
  })

  it('shows Therapist search after staffing or therapist assigned', () => {
    const snap = derivePortalLifecycle({
      stage: 'RBT_SEARCH',
      assessmentStatus: 'SIGNED',
      hasTherapistAssigned: false,
    })
    expect(snap.currentId).toBe('THERAPIST_SEARCH')
    expect(snap.stages[2]?.done).toBe(true)
  })

  it('marks therapist search done when a therapist is on the care team', () => {
    const snap = derivePortalLifecycle({
      stage: 'APPROVED',
      assessmentStatus: 'SIGNED',
      hasTherapistAssigned: true,
    })
    expect(snap.stages[3]?.done).toBe(true)
  })
})

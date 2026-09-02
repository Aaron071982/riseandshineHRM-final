import {
  COVERAGE_STATES,
  type CoverageState,
  isCoverageState,
  isPointInCoverageArea,
  isPointInStateBbox,
  normalizeUsState,
} from '@/lib/crm/therapistClientMap/coverageStates'

export type CoordinateValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

/**
 * A cached pin is shown only when coordinates fall inside our service area
 * and match the address state when one is on file.
 */
export function validateMapCoordinates(
  lat: number,
  lng: number,
  addressState: string | null | undefined
): CoordinateValidationResult {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, reason: 'invalid_coordinates' }
  }

  const state = normalizeUsState(addressState)

  if (state && isCoverageState(state)) {
    if (!isPointInStateBbox(lat, lng, state as CoverageState)) {
      return {
        valid: false,
        reason: `coordinates_outside_${state.toLowerCase()}`,
      }
    }
    return { valid: true }
  }

  if (!isPointInCoverageArea(lat, lng)) {
    return { valid: false, reason: 'outside_coverage_area' }
  }

  return { valid: true }
}

export function coverageStateListLabel(): string {
  return COVERAGE_STATES.join(', ')
}

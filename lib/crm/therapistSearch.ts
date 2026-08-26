import type {
  Ethnicity,
  EthnicityPreference,
  GenderPreference,
  PostHireStage,
  RBTStatus,
} from '@prisma/client'
import {
  isSchedulableRbt,
  SCHEDULABLE_RBT_WHERE,
} from '@/lib/rbt/schedulable'

/** Schedulable + ACTIVE activity — used by therapist search and scheduling proximity. */
export const PLACEABLE_RBT_WHERE = SCHEDULABLE_RBT_WHERE

export type PlaceableRbt = {
  status: RBTStatus
  postHireStage: PostHireStage | null
  activityState?: string | null
}

/** Pure counterpart to PLACEABLE_RBT_WHERE for tests and non-Prisma callers. */
export function isPlaceableForSearch(rbt: PlaceableRbt): boolean {
  return isSchedulableRbt(rbt)
}

export type TherapistPreferences = {
  preferredRbtGender?: GenderPreference | null
  preferredRbtEthnicities?: EthnicityPreference[] | null
}

export type PreferenceCandidate = {
  gender?: string | null
  ethnicity?: Ethnicity | null
  drivingDurationMinutes: number | null
}

export type PreferenceMatch = {
  gender: boolean
  ethnicity: boolean
  hasGenderPreference: boolean
  hasEthnicityPreference: boolean
  matchCount: number
}

export function normalizeRbtGender(value: string | null | undefined):
  | 'MALE'
  | 'FEMALE'
  | null {
  const normalized = value?.trim().toUpperCase()
  if (normalized === 'MALE' || normalized === 'M') return 'MALE'
  if (normalized === 'FEMALE' || normalized === 'F') return 'FEMALE'
  return null
}

export function getPreferenceMatch(
  candidate: Pick<PreferenceCandidate, 'gender' | 'ethnicity'>,
  preferences: TherapistPreferences
): PreferenceMatch {
  const genderPref = preferences.preferredRbtGender ?? null
  const ethnicityPrefs = preferences.preferredRbtEthnicities ?? []
  const hasGenderPreference = !!genderPref && genderPref !== 'ANY'
  const hasEthnicityPreference = ethnicityPrefs.length > 0
  const gender =
    hasGenderPreference &&
    normalizeRbtGender(candidate.gender) === genderPref
  const ethnicity =
    hasEthnicityPreference &&
    !!candidate.ethnicity &&
    ethnicityPrefs.includes(candidate.ethnicity as EthnicityPreference)

  return {
    gender,
    ethnicity,
    hasGenderPreference,
    hasEthnicityPreference,
    matchCount: Number(gender) + Number(ethnicity),
  }
}

/**
 * Drive time remains dominant. A preference match can improve ordering by at
 * most two minutes, so it only nudges otherwise-nearby candidates.
 */
export function preferenceAdjustedMinutes(
  candidate: PreferenceCandidate,
  preferences: TherapistPreferences
): number {
  const minutes = candidate.drivingDurationMinutes ?? Number.POSITIVE_INFINITY
  const match = getPreferenceMatch(candidate, preferences)
  return minutes - match.matchCount
}

export function rankByDriveTimeWithPreferences<T extends PreferenceCandidate>(
  rows: T[],
  preferences: TherapistPreferences
): T[] {
  return [...rows].sort((a, b) => {
    const adjusted =
      preferenceAdjustedMinutes(a, preferences) -
      preferenceAdjustedMinutes(b, preferences)
    if (adjusted !== 0) return adjusted
    return (
      (a.drivingDurationMinutes ?? Number.POSITIVE_INFINITY) -
      (b.drivingDurationMinutes ?? Number.POSITIVE_INFINITY)
    )
  })
}

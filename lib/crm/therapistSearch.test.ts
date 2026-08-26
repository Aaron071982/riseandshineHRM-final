import { describe, expect, it } from 'vitest'
import {
  getPreferenceMatch,
  isPlaceableForSearch,
  normalizeRbtGender,
  rankByDriveTimeWithPreferences,
} from './therapistSearch'

describe('Therapist Search candidate eligibility', () => {
  it('includes all statuses except FIRED and REJECTED', () => {
    expect(
      isPlaceableForSearch({ status: 'HIRED', postHireStage: 'MATCHING' })
    ).toBe(true)
    expect(
      isPlaceableForSearch({
        status: 'ONBOARDING_COMPLETED',
        postHireStage: null,
      })
    ).toBe(true)
    expect(
      isPlaceableForSearch({
        status: 'HIRED',
        postHireStage: 'ACTIVE_DELIVERY',
      })
    ).toBe(true)
    for (const status of [
      'NEW',
      'REACH_OUT',
      'STALLED',
      'TO_INTERVIEW',
    ] as const) {
      expect(isPlaceableForSearch({ status, postHireStage: null })).toBe(true)
    }
  })

  it('excludes FIRED and REJECTED', () => {
    for (const status of ['FIRED', 'REJECTED'] as const) {
      expect(isPlaceableForSearch({ status, postHireStage: 'MATCHING' })).toBe(
        false
      )
    }
  })

  it('excludes INACTIVE activity even when HIRED', () => {
    expect(
      isPlaceableForSearch({
        status: 'HIRED',
        postHireStage: 'MATCHING',
        activityState: 'INACTIVE',
      })
    ).toBe(false)
    expect(
      isPlaceableForSearch({
        status: 'HIRED',
        postHireStage: 'MATCHING',
        activityState: 'ACTIVE',
      })
    ).toBe(true)
  })
})

describe('Therapist Search preference ranking', () => {
  it('normalizes free-text RBT gender', () => {
    expect(normalizeRbtGender('Male')).toBe('MALE')
    expect(normalizeRbtGender(' female ')).toBe('FEMALE')
    expect(normalizeRbtGender('unknown')).toBeNull()
  })

  it('reports why a candidate matches', () => {
    expect(
      getPreferenceMatch(
        { gender: 'Male', ethnicity: 'SOUTH_ASIAN' },
        {
          preferredRbtGender: 'MALE',
          preferredRbtEthnicities: ['SOUTH_ASIAN'],
        }
      )
    ).toMatchObject({ gender: true, ethnicity: true, matchCount: 2 })
  })

  it('keeps distance dominant while lightly nudging nearby matches', () => {
    const rows = [
      {
        id: 'near-nonmatch',
        gender: 'Female',
        ethnicity: 'WHITE' as const,
        drivingDurationMinutes: 10,
      },
      {
        id: 'near-match',
        gender: 'Male',
        ethnicity: 'ASIAN' as const,
        drivingDurationMinutes: 11,
      },
      {
        id: 'far-match',
        gender: 'Male',
        ethnicity: 'ASIAN' as const,
        drivingDurationMinutes: 25,
      },
    ]
    const ranked = rankByDriveTimeWithPreferences(rows, {
      preferredRbtGender: 'MALE',
      preferredRbtEthnicities: ['ASIAN'],
    })
    expect(ranked.map((r) => r.id)).toEqual([
      'near-match',
      'near-nonmatch',
      'far-match',
    ])
  })

  it('treats ANY and empty ethnicities as neutral', () => {
    const match = getPreferenceMatch(
      { gender: 'Female', ethnicity: 'BLACK' },
      { preferredRbtGender: 'ANY', preferredRbtEthnicities: [] }
    )
    expect(match).toMatchObject({
      gender: false,
      ethnicity: false,
      hasGenderPreference: false,
      hasEthnicityPreference: false,
      matchCount: 0,
    })
  })
})

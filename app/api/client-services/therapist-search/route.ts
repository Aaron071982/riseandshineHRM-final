import { NextRequest, NextResponse } from 'next/server'
import type { EthnicityPreference, GenderPreference } from '@prisma/client'
import { requireClientServicesSession } from '@/lib/client-services/access'
import {
  auditClientAction,
  canAccessDepartment,
  CrmAccessError,
} from '@/lib/crm/access'
import {
  getPreferenceMatch,
  PLACEABLE_RBT_WHERE,
  rankByDriveTimeWithPreferences,
} from '@/lib/crm/therapistSearch'
import { loadTherapistSearchClient } from '@/lib/crm/therapistSearchData'
import { runRbtProximitySearch } from '@/lib/scheduling-beta/proximitySearch'
import { getOrgTrainingStaffingSummariesForRbtProfiles } from '@/lib/org-training/staffingSummary'
import { assertRateLimit } from '@/lib/otp-rate-limit'

export const maxDuration = 60

const GENDERS = new Set<GenderPreference>(['MALE', 'FEMALE', 'ANY'])
const ETHNICITIES = new Set<EthnicityPreference>([
  'WHITE',
  'ASIAN',
  'BLACK',
  'HISPANIC',
  'SOUTH_ASIAN',
  'MIDDLE_EASTERN',
])

export async function POST(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  if (!canAccessDepartment(user, 'STAFFING')) {
    return NextResponse.json(
      { error: 'Staffing access required' },
      { status: 403 }
    )
  }

  const limited = await assertRateLimit(
    `crm:therapist-search:user:${user.id}`,
    20,
    15 * 60 * 1000,
    'Too many therapist searches. Please wait before trying again.'
  )
  if (limited) return limited

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const clientId =
      typeof body.clientId === 'string' ? body.clientId.trim() : ''

    let clientAddress =
      typeof body.clientAddress === 'string' ? body.clientAddress.trim() : ''
    let clientCity =
      typeof body.clientCity === 'string' ? body.clientCity.trim() : ''
    let clientState =
      typeof body.clientState === 'string' ? body.clientState.trim() : ''
    let clientZip =
      typeof body.clientZip === 'string' ? body.clientZip.trim() : ''
    let preferredRbtGender: GenderPreference | null = null
    let preferredRbtEthnicities: EthnicityPreference[] = []

    if (clientId) {
      const client = await loadTherapistSearchClient(user, clientId)
      clientAddress = client.addressLine ?? ''
      clientCity = client.city ?? ''
      clientState = client.state ?? ''
      clientZip = client.zip ?? ''
      preferredRbtGender = client.preferredRbtGender
      preferredRbtEthnicities = client.preferredRbtEthnicities
    } else {
      const rawGender =
        typeof body.preferredRbtGender === 'string'
          ? body.preferredRbtGender
          : ''
      preferredRbtGender = GENDERS.has(rawGender as GenderPreference)
        ? (rawGender as GenderPreference)
        : null
      preferredRbtEthnicities = Array.isArray(body.preferredRbtEthnicities)
        ? body.preferredRbtEthnicities.filter(
            (value): value is EthnicityPreference =>
              typeof value === 'string' &&
              ETHNICITIES.has(value as EthnicityPreference)
          )
        : []
    }

    const result = await runRbtProximitySearch({
      clientAddress,
      clientCity,
      clientState,
      clientZip,
      limit: 10,
      rbtWhere: PLACEABLE_RBT_WHERE,
    })

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      )
    }

    const preferences = {
      preferredRbtGender,
      preferredRbtEthnicities,
    }
    const rbtsRanked = rankByDriveTimeWithPreferences(
      result.rbts,
      preferences
    )
    const trainingByProfile = await getOrgTrainingStaffingSummariesForRbtProfiles(
      rbtsRanked.map((r) => r.rbtProfileId)
    )
    const rbts = rbtsRanked.map((rbt) => ({
      ...rbt,
      preferenceMatch: getPreferenceMatch(rbt, preferences),
      training: trainingByProfile[rbt.rbtProfileId] ?? null,
    }))

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId || null,
      action: 'THERAPIST_SEARCH',
    })

    return NextResponse.json({
      ...result,
      rbts,
      preferences,
    })
  } catch (error) {
    if (error instanceof CrmAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    console.error('[crm-therapist-search]', error)
    return NextResponse.json(
      { error: 'Failed to search therapists' },
      { status: 500 }
    )
  }
}

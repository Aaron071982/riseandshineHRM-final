export type ArtemisStatus = 'TRAINED' | 'BOOKED' | 'NOT_STARTED'

const HIRED_STATUSES = new Set(['HIRED', 'ONBOARDING_COMPLETED'])

export function isHiredForArtemis(status: string | null | undefined): boolean {
  return HIRED_STATUSES.has((status ?? '').toUpperCase())
}

export type ActiveBookingForStatus = {
  attendanceStatus: string
  sessionEndTime: Date
  sessionStatus?: string
}

export function getArtemisStatus(
  profile: {
    status: string
    artemisTrainingCompleted: boolean
  },
  activeBooking?: ActiveBookingForStatus | null
): ArtemisStatus | null {
  if (!isHiredForArtemis(profile.status)) return null

  if (profile.artemisTrainingCompleted) return 'TRAINED'

  const booking = activeBooking
  if (
    booking &&
    booking.attendanceStatus === 'BOOKED' &&
    booking.sessionEndTime > new Date() &&
    (booking.sessionStatus == null || booking.sessionStatus !== 'CANCELLED')
  ) {
    return 'BOOKED'
  }

  return 'NOT_STARTED'
}

export function artemisStatusMatchesFilter(
  status: ArtemisStatus | null,
  filter: string
): boolean {
  if (!filter) return true
  switch (filter) {
    case 'trained':
      return status === 'TRAINED'
    case 'booked':
      return status === 'BOOKED'
    case 'not_started':
      return status === 'NOT_STARTED'
    case 'awaiting':
      return status === 'BOOKED' || status === 'NOT_STARTED'
    default:
      return true
  }
}

export function countAwaitingArtemis(
  profiles: { status: string; artemisTrainingCompleted: boolean }[]
): number {
  return profiles.filter((p) => isHiredForArtemis(p.status) && !p.artemisTrainingCompleted).length
}

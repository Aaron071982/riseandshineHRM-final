'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, MapPin, Calendar, Clock, Award, MessageCircle } from 'lucide-react'
import { useRBTMessageModal } from '@/components/layout/RBTLayout'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
function hourToLabel(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

type AvailabilitySlot = {
  id: string
  dayOfWeek: number
  hour: number
}

type UserProfile = {
  startDate: Date | null
  rbtCertificationNumber: string | null
  rbtCertificationExpiresAt: Date | null
} | null

type Profile = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phoneNumber: string
  addressLine1: string | null
  addressLine2: string | null
  locationCity: string | null
  locationState: string | null
  zipCode: string | null
  status: string
  createdAt: Date
  availabilitySlots?: AvailabilitySlot[]
  user?: { profile: UserProfile }
}

interface RBTProfileViewProps {
  profile: Profile
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function RBTProfileView({ profile }: RBTProfileViewProps) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
  const initial = (profile.firstName?.charAt(0) || profile.lastName?.charAt(0) || 'R').toUpperCase()
  const openMessageModal = useRBTMessageModal()
  const userProfile = profile.user?.profile ?? null
  const hireDate = userProfile?.startDate ?? null
  const rbtCert = userProfile?.rbtCertificationNumber ?? null
  const rbtCertExpiry = userProfile?.rbtCertificationExpiresAt ?? null

  const addressParts = [
    profile.addressLine1,
    profile.addressLine2,
    [profile.locationCity, profile.locationState].filter(Boolean).join(', '),
    profile.zipCode,
  ].filter(Boolean)
  const addressLine = addressParts.length > 0 ? addressParts.join(', ') : '—'

  const availabilitySlots = profile.availabilitySlots ?? []
  const byDay = availabilitySlots.reduce<Record<number, number[]>>((acc, s) => {
    if (!acc[s.dayOfWeek]) acc[s.dayOfWeek] = []
    acc[s.dayOfWeek].push(s.hour)
    return acc
  }, {})
  const availabilityLines = Object.entries(byDay)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([day, hours]) => {
      const dayName = DAY_NAMES[Number(day)]
      const sorted = [...hours].sort((a, b) => a - b)
      const ranges: string[] = []
      let i = 0
      while (i < sorted.length) {
        let j = i
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
        const startHour = sorted[i]
        const endHour = sorted[j] + 1
        ranges.push(`${hourToLabel(startHour)}–${hourToLabel(endHour)}`)
        i = j + 1
      }
      return `${dayName}: ${ranges.join(', ')}`
    })
  const availabilityText = availabilityLines.length > 0 ? availabilityLines.join('; ') : '—'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#e36f1e] dark:bg-[var(--orange-primary)] flex items-center justify-center text-white text-lg font-medium">
          {initial}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
            Profile
          </h1>
          <p className="text-gray-600 dark:text-[var(--text-tertiary)]">{fullName}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Contact & details
          </CardTitle>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">Email:</span> {profile.email ?? '—'}</p>
            <p><span className="font-medium">Phone:</span> {profile.phoneNumber}</p>
            <p><span className="font-medium">Employment status:</span> {profile.status}</p>
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span><span className="font-medium">Address:</span> {addressLine}</span>
            </p>
            <p className="flex items-center gap-2">
              <Calendar className="w-4 h-4 shrink-0" />
              <span><span className="font-medium">Hire date:</span> {formatDate(hireDate)}</span>
            </p>
            <p className="flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              <span><span className="font-medium">Availability:</span> {availabilityText}</span>
            </p>
            {(rbtCert || rbtCertExpiry) && (
              <p className="flex items-center gap-2">
                <Award className="w-4 h-4 shrink-0" />
                <span>
                  <span className="font-medium">RBT certification:</span>{' '}
                  {rbtCert ?? '—'} {rbtCertExpiry ? `(expires ${formatDate(rbtCertExpiry)})` : ''}
                </span>
              </p>
            )}
            <div className="pt-3">
              <Button
                variant="outline"
                className="gap-2 border-orange-200 dark:border-[var(--border-subtle)]"
                onClick={openMessageModal}
              >
                <MessageCircle className="w-4 h-4" />
                Contact Admin
              </Button>
            </div>
          </CardContent>
        </CardHeader>
      </Card>
    </div>
  )
}

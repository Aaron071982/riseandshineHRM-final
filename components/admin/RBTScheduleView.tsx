'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface RBTScheduleViewProps {
  rbtProfileId: string
  rbtName: string
}

interface AvailabilitySlot {
  dayOfWeek: number
  hour: number
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function RBTScheduleView({ rbtProfileId, rbtName }: RBTScheduleViewProps) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduleCompleted, setScheduleCompleted] = useState(false)

  useEffect(() => {
    fetchSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rbtProfileId])

  const fetchSchedule = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/rbts/${rbtProfileId}/availability`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setSlots(data.slots || [])
        setScheduleCompleted(data.rbtProfile?.scheduleCompleted || false)
      }
    } catch (err) {
      console.error('Error fetching schedule:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatHour = (hour: number) => {
    if (hour === 12) return '12:00 PM'
    if (hour < 12) return `${hour}:00 AM`
    return `${hour - 12}:00 PM`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-gray-600">Loading schedule...</p>
        </CardContent>
      </Card>
    )
  }

  if (!scheduleCompleted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
          <CardDescription>Availability for {rbtName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p>This RBT has not yet set their weekly schedule.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Weekly Schedule</CardTitle>
            <CardDescription>Availability for {rbtName}</CardDescription>
          </div>
          <Badge className="bg-green-500">
            {slots.length} slot{slots.length !== 1 ? 's' : ''} per week
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-900">Schedule Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {DAYS.map((day, index) => {
              const daySlots = slots.filter((slot) => slot.dayOfWeek === index)
              if (daySlots.length === 0) return null
              const minHour = Math.min(...daySlots.map((s) => s.hour))
              const maxHour = Math.max(...daySlots.map((s) => s.hour))
              return (
                <div key={index} className="p-3 bg-orange-50 rounded-lg">
                  <div className="font-medium text-gray-900">{day}</div>
                  <div className="text-gray-600 text-xs mt-1">
                    {formatHour(minHour)} - {formatHour(maxHour + 1)}
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    {daySlots.length} hour{daySlots.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


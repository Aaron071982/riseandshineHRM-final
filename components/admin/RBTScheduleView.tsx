'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, Circle } from 'lucide-react'

interface RBTScheduleViewProps {
  rbtProfileId: string
  rbtName: string
}

interface AvailabilitySlot {
  dayOfWeek: number
  hour: number
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 8 }, (_, i) => i + 14) // 2 PM to 9 PM (14-21)

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
      const response = await fetch(`/api/admin/rbts/${rbtProfileId}/availability`)
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

  const isSlotSelected = (dayOfWeek: number, hour: number) => {
    return slots.some((slot) => slot.dayOfWeek === dayOfWeek && slot.hour === hour)
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
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="grid grid-cols-8 gap-2">
              {/* Header row */}
              <div className="font-semibold text-sm text-gray-700 p-2">Time</div>
              {DAYS.map((day, index) => (
                <div key={index} className="font-semibold text-sm text-gray-700 p-2 text-center">
                  {day.substring(0, 3)}
                </div>
              ))}

              {/* Time slots */}
              {HOURS.map((hour) => (
                <>
                  <div key={`time-${hour}`} className="text-sm text-gray-600 p-2 border-r">
                    {formatHour(hour)} - {formatHour(hour + 1)}
                  </div>
                  {DAYS.map((_, dayOfWeek) => {
                    const isSelected = isSlotSelected(dayOfWeek, hour)
                    return (
                      <div
                        key={`${dayOfWeek}-${hour}`}
                        className={`
                          h-12 border rounded-lg
                          ${isSelected
                            ? 'bg-orange-500 border-orange-600'
                            : 'bg-gray-50 border-gray-200'
                          }
                          flex items-center justify-center
                        `}
                      >
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-semibold text-gray-900 mb-3">Schedule Summary</h4>
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


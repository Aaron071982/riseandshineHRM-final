'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface ScheduleSetupProps {
  rbtProfileId: string
  onComplete?: () => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 8 }, (_, i) => i + 14) // 2 PM to 9 PM (14-21)

export default function ScheduleSetup({ rbtProfileId, onComplete }: ScheduleSetupProps) {
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing availability
  useEffect(() => {
    fetchAvailability()
  }, [rbtProfileId])

  const fetchAvailability = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/rbt/availability')
      if (response.ok) {
        const slots: Array<{ dayOfWeek: number; hour: number }> = await response.json()
        const slotKeys = new Set<string>(
          slots.map((slot) => `${slot.dayOfWeek}-${slot.hour}`)
        )
        setSelectedSlots(slotKeys)
      }
    } catch (err) {
      console.error('Error fetching availability:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleSlot = (dayOfWeek: number, hour: number) => {
    const key = `${dayOfWeek}-${hour}`
    const newSelected = new Set(selectedSlots)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedSlots(newSelected)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      // Convert selected slots to array format
      const slots = Array.from(selectedSlots).map((key) => {
        const [dayOfWeek, hour] = key.split('-').map(Number)
        return { dayOfWeek, hour }
      })

      const response = await fetch('/api/rbt/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slots }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save schedule')
      }

      if (onComplete) {
        onComplete()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save schedule')
    } finally {
      setSaving(false)
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
          <p className="text-gray-600">Loading your schedule...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Your Weekly Schedule</CardTitle>
        <CardDescription>
          Select the time blocks when you&apos;re available each week. Click on a cell to toggle
          availability.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Schedule Grid */}
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
                      const key = `${dayOfWeek}-${hour}`
                      const isSelected = selectedSlots.has(key)
                      return (
                        <button
                          key={`${dayOfWeek}-${hour}`}
                          onClick={() => toggleSlot(dayOfWeek, hour)}
                          className={`
                            h-12 border rounded-lg transition-all
                            ${isSelected
                              ? 'bg-orange-500 text-white border-orange-600 hover:bg-orange-600'
                              : 'bg-white border-gray-300 hover:bg-orange-50 hover:border-orange-300'
                            }
                            flex items-center justify-center
                          `}
                          type="button"
                        >
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      )
                    })}
                  </>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Schedule'
              )}
            </Button>
          </div>

          <p className="text-sm text-gray-500 mt-2">
            Selected {selectedSlots.size} time slot{selectedSlots.size !== 1 ? 's' : ''} per week
          </p>
        </div>
      </CardContent>
    </Card>
  )
}


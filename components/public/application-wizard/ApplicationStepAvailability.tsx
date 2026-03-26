'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import type { ApplicationData } from './types'

interface ApplicationStepAvailabilityProps {
  data: ApplicationData
  setData: React.Dispatch<React.SetStateAction<ApplicationData>>
}

export default function ApplicationStepAvailability({ data, setData }: ApplicationStepAvailabilityProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2 text-gray-900">Availability</h2>
        <p className="text-gray-600">
          Most RBT sessions occur after 2PM on weekdays and on weekends. Please indicate your availability.
        </p>
      </div>
      <div className="space-y-6">
        <div>
          <Label>Weekday Availability (after 2PM)</Label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
              <div key={day} className="flex items-center space-x-2">
                <Checkbox
                  id={`weekday-${day}`}
                  checked={data.weekdayAvailability[day] || false}
                  onCheckedChange={(checked) => {
                    setData({
                      ...data,
                      weekdayAvailability: { ...data.weekdayAvailability, [day]: checked as boolean },
                    })
                  }}
                />
                <Label htmlFor={`weekday-${day}`} className="font-normal cursor-pointer">
                  {day}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label>Weekend Availability</Label>
          <div className="grid grid-cols-2 gap-4 mt-2">
            {['Saturday', 'Sunday'].map((day) => (
              <div key={day} className="flex items-center space-x-2">
                <Checkbox
                  id={`weekend-${day}`}
                  checked={data.weekendAvailability[day] || false}
                  onCheckedChange={(checked) => {
                    setData({
                      ...data,
                      weekendAvailability: { ...data.weekendAvailability, [day]: checked as boolean },
                    })
                  }}
                />
                <Label htmlFor={`weekend-${day}`} className="font-normal cursor-pointer">
                  {day}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="preferredHoursRange">Preferred Weekly Hours Range *</Label>
          <Select
            value={data.preferredHoursRange}
            onValueChange={(value) => setData({ ...data, preferredHoursRange: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10-15">10-15 hours</SelectItem>
              <SelectItem value="15-25">15-25 hours</SelectItem>
              <SelectItem value="25-35">25-35 hours</SelectItem>
              <SelectItem value="35+">35+ hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="earliestStartTime">Earliest Start Time</Label>
            <Input
              id="earliestStartTime"
              type="time"
              value={data.earliestStartTime}
              onChange={(e) => setData({ ...data, earliestStartTime: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="latestEndTime">Latest End Time</Label>
            <Input
              id="latestEndTime"
              type="time"
              value={data.latestEndTime}
              onChange={(e) => setData({ ...data, latestEndTime: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

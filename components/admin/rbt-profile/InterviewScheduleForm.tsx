'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DialogFooter } from '@/components/ui/dialog'

function nyTimeToUTC(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, min] = timeStr.split(':').map(Number)
  const testDateUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const nyFormatted = testDateUTC.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const nyHour = parseInt(nyFormatted.split(', ')[1].split(':')[0], 10)
  const offsetHours = 12 - nyHour
  const utcDate = new Date(Date.UTC(y, m - 1, d, h + offsetHours, min, 0))
  return utcDate.toISOString()
}

interface InterviewScheduleFormProps {
  rbtProfileId: string
  onSubmit: (data: { scheduledAt: string; durationMinutes: number; interviewerName: string }) => void
  onCancel: () => void
}

export default function InterviewScheduleForm({ onSubmit, onCancel }: InterviewScheduleFormProps) {
  const [interviewerEmail, setInterviewerEmail] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const dateStr = formData.get('date') as string
    const timeStr = formData.get('time') as string
    onSubmit({
      scheduledAt: nyTimeToUTC(dateStr, timeStr),
      durationMinutes: 30,
      interviewerName: interviewerEmail,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="time">Time</Label>
        <Input id="time" name="time" type="time" step="1800" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input id="duration" name="duration" type="number" defaultValue={30} readOnly className="bg-gray-50" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="interviewerEmail">Interviewer Email</Label>
        <Select value={interviewerEmail} onValueChange={setInterviewerEmail} required>
          <SelectTrigger>
            <SelectValue placeholder="Select interviewer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aaronsiam21@gmail.com">aaronsiam21@gmail.com</SelectItem>
            <SelectItem value="kazi@siyam.nyc">kazi@siyam.nyc</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Schedule Interview</Button>
      </DialogFooter>
    </form>
  )
}

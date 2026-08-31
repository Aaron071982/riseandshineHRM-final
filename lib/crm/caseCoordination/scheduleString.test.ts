import { describe, expect, it } from 'vitest'
import { formatScheduleForBt } from './scheduleString'

describe('formatScheduleForBt', () => {
  it('formats weekend slots with shared hours', () => {
    const result = formatScheduleForBt([
      { dayOfWeek: 6, startTime: '12:00', endTime: '16:00' },
      { dayOfWeek: 0, startTime: '12:00', endTime: '16:00' },
    ])
    expect(result).toBe('Saturday, Sunday 12:00 PM–4:00 PM')
  })

  it('groups different time blocks separately', () => {
    const result = formatScheduleForBt([
      { dayOfWeek: 1, startTime: '09:00', endTime: '11:00' },
      { dayOfWeek: 3, startTime: '14:00', endTime: '16:00' },
    ])
    expect(result).toBe('Monday 9:00 AM–11:00 AM; Wednesday 2:00 PM–4:00 PM')
  })

  it('returns empty string when no slots', () => {
    expect(formatScheduleForBt([])).toBe('')
  })
})

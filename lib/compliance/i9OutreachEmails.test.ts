import { describe, expect, it } from 'vitest'
import {
  dueI9Reminder,
  easternCalendarDaysBetween,
  generateI9CollectionReminderEmail,
  generateI9CollectionRequestEmail,
  i9DueDateFrom,
} from './i9OutreachEmails'

const LINK = 'https://www.riseandshinehrm.com/rbt/i9'

describe('I-9 outreach emails', () => {
  const request = generateI9CollectionRequestEmail({
    firstName: 'Jordan',
    i9TaskLink: LINK,
    dueDate: new Date('2026-10-14T16:00:00Z'),
  })
  const reminder = generateI9CollectionReminderEmail({ firstName: 'Jordan', i9TaskLink: LINK })

  it('contains the task link, due date, and sender', () => {
    expect(request.subject).toBe('Action needed: Form I-9 employment verification')
    expect(request.html).toContain(LINK)
    expect(request.html).toContain('Wednesday, October 14, 2026')
    expect(request.html).toContain('Rise &amp; Shine HR')
    expect(request.html).toContain('Human Resources')
    expect(reminder.html).toContain(LINK)
  })

  it('keeps the uniform-outreach line and the no-email-documents warning', () => {
    expect(request.html).toContain('This request is going to all staff whose I-9 isn&apos;t currently on file')
    expect(request.html).toContain('Please do not email photos or scans of your documents.')
  })

  it('never mentions booking an appointment or names a specific document to bring', () => {
    for (const html of [request.html, reminder.html]) {
      expect(html).not.toMatch(/\bbook|appointment|calendly/i)
      expect(html).not.toMatch(/passport|driver/i)
    }
  })

  it('escapes the first name', () => {
    const { html } = generateI9CollectionReminderEmail({ firstName: '<b>x</b>', i9TaskLink: LINK })
    expect(html).toContain('Hi &lt;b&gt;x&lt;/b&gt;,')
  })
})

describe('I-9 reminder schedule', () => {
  const sentAt = new Date('2026-10-07T19:00:00Z') // Oct 7, 3pm ET

  it('counts Eastern calendar days, not 24h periods', () => {
    expect(easternCalendarDaysBetween(sentAt, new Date('2026-10-10T14:00:00Z'))).toBe(3)
    expect(easternCalendarDaysBetween(sentAt, new Date('2026-10-08T03:00:00Z'))).toBe(0)
  })

  it('due date is 7 days after sending', () => {
    expect(easternCalendarDaysBetween(sentAt, i9DueDateFrom(sentAt))).toBe(7)
  })

  it('sends day 3, then day 7, and only the latest when both are due', () => {
    const none = { day3: false, day7: false }
    expect(dueI9Reminder(sentAt, new Date('2026-10-09T14:00:00Z'), none)).toBeNull()
    expect(dueI9Reminder(sentAt, new Date('2026-10-10T14:00:00Z'), none)).toBe(3)
    expect(dueI9Reminder(sentAt, new Date('2026-10-11T14:00:00Z'), { day3: true, day7: false })).toBeNull()
    expect(dueI9Reminder(sentAt, new Date('2026-10-14T14:00:00Z'), { day3: true, day7: false })).toBe(7)
    expect(dueI9Reminder(sentAt, new Date('2026-10-14T14:00:00Z'), none)).toBe(7)
    expect(dueI9Reminder(sentAt, new Date('2026-10-20T14:00:00Z'), { day3: true, day7: true })).toBeNull()
  })
})

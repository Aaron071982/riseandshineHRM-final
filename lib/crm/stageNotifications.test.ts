import { describe, expect, it } from 'vitest'
import { buildNewClientNotificationEmail } from '@/lib/crm/stageNotifications'

describe('buildNewClientNotificationEmail', () => {
  it('includes client name, id, timestamp, and creator', () => {
    const { subject, html } = buildNewClientNotificationEmail({
      clientCode: 'CC-042',
      clientName: 'Alex Rivera',
      addedAt: new Date('2026-01-01T17:00:00.000Z'),
      addedBy: 'Jordan Lee (intake@riseandshineaba.com)',
    })

    expect(subject).toBe('New client added (CC-042)')
    expect(html).toContain('Alex Rivera')
    expect(html).toContain('CC-042')
    expect(html).toContain('Jordan Lee (intake@riseandshineaba.com)')
    expect(html).toContain('Date &amp; time')
  })
})

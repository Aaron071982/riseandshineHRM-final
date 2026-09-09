import { describe, expect, it } from 'vitest'
import { pairAttendanceVisits } from './clientAttendance'

function row(
  partial: Partial<{
    id: string
    eventType: string
    eventAt: Date
    voidedAt: Date | null
  }> & { id: string; eventType: string; eventAt: Date }
) {
  return {
    capturedAt: null,
    signedByName: 'Parent',
    signedByRelationship: 'Mother',
    signatureImageData: null,
    signatureHash: 'abc',
    signatureIpAddress: null,
    signatureUserAgent: null,
    kioskDeviceId: null,
    locationLabel: 'Front desk',
    scheduleAssignmentId: null,
    voidedAt: null,
    voidedByUserId: null,
    voidReason: null,
    createdAt: partial.eventAt,
    ...partial,
  }
}

describe('pairAttendanceVisits', () => {
  it('pairs IN then OUT with duration', () => {
    const start = new Date('2026-09-09T15:04:00Z')
    const end = new Date('2026-09-09T17:12:00Z')
    const { visits, voidedEvents } = pairAttendanceVisits([
      row({ id: '1', eventType: 'IN', eventAt: start }),
      row({ id: '2', eventType: 'OUT', eventAt: end }),
    ])
    expect(voidedEvents).toHaveLength(0)
    expect(visits).toHaveLength(1)
    expect(visits[0].open).toBe(false)
    expect(visits[0].durationMinutes).toBe(128)
  })

  it('keeps open IN as signed in', () => {
    const { visits } = pairAttendanceVisits([
      row({ id: '1', eventType: 'IN', eventAt: new Date('2026-09-09T15:00:00Z') }),
    ])
    expect(visits[0].open).toBe(true)
    expect(visits[0].endedAt).toBeNull()
  })

  it('flags orphan OUT', () => {
    const { visits } = pairAttendanceVisits([
      row({ id: '1', eventType: 'OUT', eventAt: new Date('2026-09-09T15:00:00Z') }),
    ])
    expect(visits[0].orphanOut).toBe(true)
  })

  it('skips voided when pairing but returns them', () => {
    const { visits, voidedEvents } = pairAttendanceVisits([
      row({
        id: '1',
        eventType: 'IN',
        eventAt: new Date('2026-09-09T15:00:00Z'),
        voidedAt: new Date('2026-09-09T16:00:00Z'),
      }),
      row({ id: '2', eventType: 'IN', eventAt: new Date('2026-09-09T17:00:00Z') }),
    ])
    expect(voidedEvents).toHaveLength(1)
    expect(visits).toHaveLength(1)
    expect(visits[0].inEvent?.id).toBe('2')
  })
})

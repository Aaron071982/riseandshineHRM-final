export type AttendanceEventDto = {
  id: string
  eventType: 'IN' | 'OUT'
  eventAt: string
  capturedAt: string | null
  signedByName: string
  signedByRelationship: string
  signatureImageData: string | null
  signatureHash: string
  signatureIpAddress: string | null
  signatureUserAgent: string | null
  kioskDeviceId: string | null
  locationLabel: string | null
  scheduleAssignmentId: string | null
  voidedAt: string | null
  voidedByUserId: string | null
  voidReason: string | null
  createdAt: string
}

export type AttendanceVisit = {
  id: string
  dateLabel: string
  startedAt: string
  endedAt: string | null
  durationMinutes: number | null
  open: boolean
  orphanOut: boolean
  signedByName: string
  signedByRelationship: string
  inEvent: AttendanceEventDto | null
  outEvent: AttendanceEventDto | null
}

function toDto(row: {
  id: string
  eventType: string
  eventAt: Date
  capturedAt: Date | null
  signedByName: string
  signedByRelationship: string
  signatureImageData: string | null
  signatureHash: string
  signatureIpAddress: string | null
  signatureUserAgent: string | null
  kioskDeviceId: string | null
  locationLabel: string | null
  scheduleAssignmentId: string | null
  voidedAt: Date | null
  voidedByUserId: string | null
  voidReason: string | null
  createdAt: Date
}): AttendanceEventDto {
  return {
    id: row.id,
    eventType: row.eventType === 'OUT' ? 'OUT' : 'IN',
    eventAt: row.eventAt.toISOString(),
    capturedAt: row.capturedAt?.toISOString() ?? null,
    signedByName: row.signedByName,
    signedByRelationship: row.signedByRelationship,
    signatureImageData: row.signatureImageData,
    signatureHash: row.signatureHash,
    signatureIpAddress: row.signatureIpAddress,
    signatureUserAgent: row.signatureUserAgent,
    kioskDeviceId: row.kioskDeviceId,
    locationLabel: row.locationLabel,
    scheduleAssignmentId: row.scheduleAssignmentId,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidedByUserId: row.voidedByUserId,
    voidReason: row.voidReason,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Pair non-voided events into visits chronologically.
 * IN opens a visit; next OUT closes it. Orphan OUTs are flagged. Voided returned separately.
 */
export function pairAttendanceVisits(
  rows: Parameters<typeof toDto>[0][]
): {
  visits: AttendanceVisit[]
  events: AttendanceEventDto[]
  voidedEvents: AttendanceEventDto[]
} {
  const events = rows.map(toDto)
  const live = events.filter((e) => !e.voidedAt)
  const voidedEvents = events.filter((e) => !!e.voidedAt)

  const visits: AttendanceVisit[] = []
  let open: AttendanceVisit | null = null

  for (const ev of live) {
    if (ev.eventType === 'IN') {
      if (open) {
        visits.push(open)
      }
      open = {
        id: `visit-${ev.id}`,
        dateLabel: '',
        startedAt: ev.eventAt,
        endedAt: null,
        durationMinutes: null,
        open: true,
        orphanOut: false,
        signedByName: ev.signedByName,
        signedByRelationship: ev.signedByRelationship,
        inEvent: ev,
        outEvent: null,
      }
      continue
    }

    // OUT
    if (open) {
      const start = new Date(open.startedAt).getTime()
      const end = new Date(ev.eventAt).getTime()
      open.endedAt = ev.eventAt
      open.durationMinutes = Math.max(0, Math.round((end - start) / 60000))
      open.open = false
      open.outEvent = ev
      visits.push(open)
      open = null
    } else {
      visits.push({
        id: `orphan-${ev.id}`,
        dateLabel: '',
        startedAt: ev.eventAt,
        endedAt: ev.eventAt,
        durationMinutes: null,
        open: false,
        orphanOut: true,
        signedByName: ev.signedByName,
        signedByRelationship: ev.signedByRelationship,
        inEvent: null,
        outEvent: ev,
      })
    }
  }

  if (open) visits.push(open)

  // Newest first for UI
  visits.reverse()

  for (const v of visits) {
    const d = new Date(v.startedAt)
    v.dateLabel = d.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return { visits, events, voidedEvents }
}

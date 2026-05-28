/**
 * Minimal iCalendar for Google/Apple add-to-calendar.
 */
export function buildArtemisTrainingIcs(params: {
  uid: string
  start: Date
  end: Date
  summary: string
  description: string
  location: string
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const escapeText = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rise and Shine//Artemis Training//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(params.start)}`,
    `DTEND:${fmt(params.end)}`,
    `SUMMARY:${escapeText(params.summary)}`,
    `DESCRIPTION:${escapeText(params.description)}`,
    `LOCATION:${escapeText(params.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

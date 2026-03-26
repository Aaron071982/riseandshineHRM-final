import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function formatIcsUtcDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/** RFC 5545 TEXT escaping for SUMMARY, DESCRIPTION, LOCATION */
function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n')
}

/** Fold long content lines (75 octets max; safe for ASCII + typical UTF-8 event text) */
function foldIcsLine(line: string): string {
  const max = 75
  if (line.length <= max) return line
  let out = ''
  let rest = line
  while (rest.length > max) {
    out += rest.slice(0, max) + '\r\n '
    rest = rest.slice(max)
  }
  return out + rest
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    const interviewId = searchParams.get('interviewId')

    if (!token || !interviewId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const interview = await prisma.interview.findFirst({
      where: {
        id: interviewId,
        status: 'SCHEDULED',
        rbtProfile: { schedulingToken: token },
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        interviewerName: true,
        meetingUrl: true,
        rbtProfile: {
          select: { firstName: true, lastName: true },
        },
      },
    })

    if (!interview) {
      return NextResponse.json({ error: 'Invalid token or interview' }, { status: 404 })
    }

    const start = new Date(interview.scheduledAt)
    const end = new Date(start.getTime() + (interview.durationMinutes ?? 15) * 60 * 1000)
    const now = new Date()

    const dtStart = formatIcsUtcDate(start)
    const dtEnd = formatIcsUtcDate(end)
    const dtStamp = formatIcsUtcDate(now)

    const rbtFullName = interview.rbtProfile ? `${interview.rbtProfile.firstName} ${interview.rbtProfile.lastName}` : ''
    const summary = 'Rise and Shine ABA Interview'
    const descriptionParts = [
      `Interview with: ${interview.interviewerName}`,
      rbtFullName ? `Candidate: ${rbtFullName}` : '',
      interview.meetingUrl ? `Meeting link: ${interview.meetingUrl}` : '',
      'This event was generated from the Rise and Shine HRM scheduling system.',
    ].filter(Boolean)
    const description = descriptionParts.join('\n')
    const meetingUrl = interview.meetingUrl || ''

    const locationLine = meetingUrl ? escapeIcsText(meetingUrl) : 'Video call'

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RiseAndShineHRM//InterviewScheduling//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      foldIcsLine(`UID:${interview.id}@riseandshinehrm`),
      foldIcsLine(`DTSTAMP:${dtStamp}`),
      foldIcsLine(`DTSTART:${dtStart}`),
      foldIcsLine(`DTEND:${dtEnd}`),
      foldIcsLine(`SUMMARY:${escapeIcsText(summary)}`),
      foldIcsLine(`DESCRIPTION:${escapeIcsText(description)}`),
      foldIcsLine(`LOCATION:${locationLine}`),
    ]
    if (meetingUrl) {
      lines.push(foldIcsLine(`URL:${escapeIcsText(meetingUrl)}`))
    }
    lines.push('END:VEVENT', 'END:VCALENDAR')

    const icsText = lines.join('\r\n')

    return new NextResponse(icsText, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="rise-and-shine-interview-${interview.id}.ics"`,
      },
    })
  } catch (error) {
    console.error('GET /api/public/calendar/ics failed:', error)
    return NextResponse.json({ error: 'Failed to generate calendar file' }, { status: 500 })
  }
}


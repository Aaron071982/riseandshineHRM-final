import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Clock } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type TimeEntryWithRelations = Prisma.TimeEntryGetPayload<{
  include: { rbtProfile: true; shift: true; sessionNote: true }
}>

function signatureLabel(status: TimeEntryWithRelations['signatureStatus']): string {
  if (!status) return '—'
  switch (status) {
    case 'SIGNED':
      return 'Signed'
    case 'MISSING':
      return 'Missing'
    case 'NA':
      return 'N/A'
    default:
      return '—'
  }
}

export default async function AttendanceRBTPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rbtProfileId } = await params

  const [rbtProfile, timeEntries] = await Promise.all([
    prisma.rBTProfile.findUnique({
      where: { id: rbtProfileId },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.timeEntry.findMany({
      where: { rbtProfileId, clockOutTime: { not: null } },
      include: {
        rbtProfile: true,
        shift: true,
        sessionNote: true,
      },
      orderBy: { clockInTime: 'desc' },
      take: 200,
    }),
  ])

  if (!rbtProfile) notFound()

  const totalHours = timeEntries.reduce((sum, e) => sum + (e.totalHours ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-500 via-green-400 to-emerald-400 p-8 shadow-lg">
        <div className="relative">
          <Link
            href="/admin/attendance"
            className="text-green-100 hover:text-white text-sm font-medium mb-2 inline-block"
          >
            ← Back to Attendance & Hours
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">
            {rbtProfile.firstName} {rbtProfile.lastName}
          </h1>
          <p className="text-green-50 text-lg">Time entries and session notes</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Total hours (all time): {totalHours.toFixed(1)}h
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time entries & session notes</CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <p className="text-gray-500 dark:text-[var(--text-tertiary)]">No time entries yet.</p>
          ) : (
            <div className="space-y-6">
              {timeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-2 border-gray-200 dark:border-[var(--border-subtle)] rounded-xl p-5 bg-white dark:bg-[var(--bg-elevated)]"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-[var(--text-tertiary)]">Date</div>
                      <div>{formatDate(entry.clockInTime)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-[var(--text-tertiary)]">Clock In</div>
                      <div>{formatDateTime(entry.clockInTime)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-[var(--text-tertiary)]">Clock Out</div>
                      <div>{entry.clockOutTime ? formatDateTime(entry.clockOutTime) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-[var(--text-tertiary)]">Duration / Signature</div>
                      <div>
                        {entry.totalHours != null ? `${entry.totalHours.toFixed(2)}h` : '—'} · {signatureLabel(entry.signatureStatus)}
                      </div>
                    </div>
                  </div>
                  {entry.shift && (
                    <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mb-2">
                      Shift: {entry.shift.clientName}
                    </div>
                  )}
                  {entry.sessionNote && (
                    <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-[var(--bg-elevated)] border border-gray-200 dark:border-[var(--border-subtle)]">
                      <div className="font-medium text-gray-900 dark:text-[var(--text-primary)] mb-2">Session notes</div>
                      {entry.sessionNote.summary && <p><span className="font-medium">Summary:</span> {entry.sessionNote.summary}</p>}
                      {entry.sessionNote.whereServicesWere && <p><span className="font-medium">Where services were:</span> {entry.sessionNote.whereServicesWere}</p>}
                      {entry.sessionNote.whosInvolved && <p><span className="font-medium">Who was involved:</span> {entry.sessionNote.whosInvolved}</p>}
                      {entry.sessionNote.goalsWorkedOn && <p><span className="font-medium">Goals worked on:</span> {entry.sessionNote.goalsWorkedOn}</p>}
                      {entry.sessionNote.behaviorsObserved && <p><span className="font-medium">Behaviors observed:</span> {entry.sessionNote.behaviorsObserved}</p>}
                      {entry.sessionNote.reinforcersUsed && <p><span className="font-medium">Reinforcers used:</span> {entry.sessionNote.reinforcersUsed}</p>}
                      {entry.sessionNote.generalComments && <p><span className="font-medium">Comments:</span> {entry.sessionNote.generalComments}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

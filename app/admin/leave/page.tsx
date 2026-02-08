import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import LeaveRequestActions from '@/components/admin/LeaveRequestActions'
import { Calendar, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type LeaveRequestWithProfile = Prisma.LeaveRequestGetPayload<{
  include: { rbtProfile: true }
}>

function LeaveError() {
  return (
    <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-[var(--status-warning-bg)] dark:border-[var(--status-warning-border)] p-6 text-center">
      <p className="font-semibold text-amber-900 dark:text-[var(--status-warning-text)]">Could not load leave requests</p>
      <p className="text-sm text-amber-700 dark:text-[var(--status-warning-text)] mt-2">The database may be temporarily unavailable. Try refreshing the page.</p>
    </div>
  )
}

export default async function LeaveRequestsPage() {
  let leaveRequests: LeaveRequestWithProfile[]
  try {
    leaveRequests = await prisma.leaveRequest.findMany({
      include: {
        rbtProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  } catch (error) {
    console.error('Admin leave: failed to load', error)
    return (
      <div className="space-y-6">
        <div className="pb-6 border-b dark:border-[var(--border-subtle)]">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Leave Requests</h1>
          <p className="text-gray-600 dark:text-[var(--text-tertiary)]">Review and manage RBT leave requests</p>
        </div>
        <LeaveError />
      </div>
    )
  }

  const statusColors: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', darkBg: 'dark:bg-yellow-900/40', darkText: 'dark:text-yellow-300' },
    APPROVED: { bg: 'bg-green-100', text: 'text-green-700', darkBg: 'dark:bg-green-900/40', darkText: 'dark:text-green-300' },
    DENIED: { bg: 'bg-red-100', text: 'text-red-700', darkBg: 'dark:bg-red-900/40', darkText: 'dark:text-red-300' },
  }

  const pendingCount = leaveRequests.filter(r => r.status === 'PENDING').length
  const approvedCount = leaveRequests.filter(r => r.status === 'APPROVED').length
  const deniedCount = leaveRequests.filter(r => r.status === 'DENIED').length

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-500 via-yellow-400 to-orange-400 p-8 shadow-lg">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Leave Requests</h1>
          <p className="text-yellow-50 text-lg">Review and manage RBT leave requests</p>
        </div>
      </div>

      {/* Stats Cards - new format with dark mode */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-hover border-2 border-yellow-200 dark:border-yellow-800/40 bg-gradient-to-br from-white to-yellow-50 dark:from-[var(--bg-elevated)] dark:to-yellow-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Pending</p>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">{pendingCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-yellow flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-green-200 dark:border-green-800/40 bg-gradient-to-br from-white to-green-50 dark:from-[var(--bg-elevated)] dark:to-green-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Approved</p>
                <p className="text-3xl font-bold text-green-600 dark:text-[var(--status-hired-text)] mt-2">{approvedCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-red-200 dark:border-red-800/40 bg-gradient-to-br from-white to-red-50 dark:from-[var(--bg-elevated)] dark:to-red-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Denied</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{deniedCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-red-400 to-red-600 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Requests List - new format with dark mode */}
      <Card className="border-2 border-yellow-100 dark:border-[var(--border-subtle)] bg-gradient-to-br from-white to-yellow-50/30 dark:from-[var(--bg-elevated)] dark:to-[var(--bg-elevated)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-200/20 dark:bg-yellow-500/10 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">All Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 dark:text-[var(--text-primary)] mb-2">No leave requests found</p>
              <p className="text-gray-500 dark:text-[var(--text-tertiary)]">RBTs will appear here once they submit leave requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaveRequests.map((request) => {
                const statusConfig = statusColors[request.status] || statusColors.PENDING
                return (
                  <div
                    key={request.id}
                    className="border-2 border-gray-200 dark:border-[var(--border-subtle)] rounded-xl p-5 bg-white dark:bg-[var(--bg-elevated)] hover:shadow-lg dark:hover:bg-[var(--bg-elevated-hover)] transition-all card-hover relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-100/30 dark:bg-yellow-500/10 rounded-full -mr-10 -mt-10" />
                    <div className="relative grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                      <div className="md:col-span-2">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-[var(--text-primary)] mb-1">
                          {request.rbtProfile.firstName} {request.rbtProfile.lastName}
                        </h3>
                        <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                          <span className="font-medium">{request.type}</span>
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-1 flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Start Date
                        </div>
                        <div className="text-gray-600 dark:text-[var(--text-tertiary)]">{formatDate(request.startDate)}</div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-1">End Date</div>
                        <div className="text-gray-600 dark:text-[var(--text-tertiary)]">{formatDate(request.endDate)}</div>
                      </div>
                      <div>
                        <Badge className={`${statusConfig.bg} ${statusConfig.text} ${statusConfig.darkBg} ${statusConfig.darkText} border-0 font-medium px-3 py-1`}>
                          {request.status}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-2">
                        {request.status === 'PENDING' && (
                          <LeaveRequestActions requestId={request.id} />
                        )}
                        {request.reason && (
                          <div className="text-xs text-gray-500 dark:text-[var(--text-tertiary)] mt-1 line-clamp-2">
                            {request.reason}
                          </div>
                        )}
                      </div>
                    </div>
                    {request.reason && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[var(--border-subtle)]">
                        <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                          <span className="font-medium dark:text-[var(--text-secondary)]">Reason:</span> {request.reason}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

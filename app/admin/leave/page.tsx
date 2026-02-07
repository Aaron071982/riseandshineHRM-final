import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import LeaveRequestActions from '@/components/admin/LeaveRequestActions'
import { Calendar, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function LeaveError() {
  return (
    <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-[var(--status-warning-bg)] dark:border-[var(--status-warning-border)] p-6 text-center">
      <p className="font-semibold text-amber-900 dark:text-[var(--status-warning-text)]">Could not load leave requests</p>
      <p className="text-sm text-amber-700 dark:text-[var(--status-warning-text)] mt-2">The database may be temporarily unavailable. Try refreshing the page.</p>
    </div>
  )
}

export default async function LeaveRequestsPage() {
  let leaveRequests: Awaited<ReturnType<typeof prisma.leaveRequest.findMany>>
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

  const statusColors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
    DENIED: { bg: 'bg-red-100', text: 'text-red-700' },
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-hover border-2 border-yellow-200 bg-gradient-to-br from-white to-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{pendingCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-yellow flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{approvedCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-red-200 bg-gradient-to-br from-white to-red-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Denied</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{deniedCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-red-400 to-red-600 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave Requests List */}
      <Card className="border-2 border-yellow-100 bg-gradient-to-br from-white to-yellow-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-200/20 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">All Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 mb-2">No leave requests found</p>
              <p className="text-gray-500">RBTs will appear here once they submit leave requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaveRequests.map((request) => {
                const statusConfig = statusColors[request.status] || statusColors.PENDING
                return (
                  <div
                    key={request.id}
                    className="border-2 border-gray-200 rounded-xl p-5 bg-white hover:shadow-lg transition-all card-hover relative overflow-hidden"
                  >
                    {/* Decorative bubble */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-100/30 rounded-full -mr-10 -mt-10" />
                    
                    <div className="relative grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                      <div className="md:col-span-2">
                        <h3 className="font-bold text-lg text-gray-900 mb-1">
                          {request.rbtProfile.firstName} {request.rbtProfile.lastName}
                        </h3>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">{request.type}</span>
                        </div>
                      </div>
                      
                      <div className="text-sm">
                        <div className="font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Start Date
                        </div>
                        <div className="text-gray-600">{formatDate(request.startDate)}</div>
                      </div>
                      
                      <div className="text-sm">
                        <div className="font-medium text-gray-700 mb-1">End Date</div>
                        <div className="text-gray-600">{formatDate(request.endDate)}</div>
                      </div>
                      
                      <div>
                        <Badge className={`${statusConfig.bg} ${statusConfig.text} border-0 font-medium px-3 py-1`}>
                          {request.status}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {request.status === 'PENDING' && (
                          <LeaveRequestActions requestId={request.id} />
                        )}
                        {request.reason && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {request.reason}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {request.reason && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Reason:</span> {request.reason}
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

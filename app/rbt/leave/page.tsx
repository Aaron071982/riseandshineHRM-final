import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import LeaveRequestForm from '@/components/rbt/LeaveRequestForm'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LeavePage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/')
  }

  const user = await validateSession(sessionToken)
  if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
    redirect('/')
  }

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      rbtProfileId: user.rbtProfileId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const statusColors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
    DENIED: { bg: 'bg-red-100', text: 'text-red-700' },
  }

  const pendingCount = leaveRequests.filter(r => r.status === 'PENDING').length
  const approvedCount = leaveRequests.filter(r => r.status === 'APPROVED').length

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-500 via-yellow-400 to-orange-400 p-8 shadow-lg">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Leave Requests</h1>
          <p className="text-yellow-50 text-lg">Request time off and view your leave history</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="card-hover border-2 border-yellow-200 bg-gradient-to-br from-white to-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Requests</p>
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
      </div>

      {/* Leave Request Form */}
      <LeaveRequestForm rbtProfileId={user.rbtProfileId} />

      {/* Leave Requests List */}
      <Card className="border-2 border-yellow-100 bg-gradient-to-br from-white to-yellow-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-200/20 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">My Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 mb-2">No leave requests submitted</p>
              <p className="text-gray-500">Submit a request using the form above</p>
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
                    
                    <div className="relative">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-900 mb-2">{request.type}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(request.startDate)}</span>
                            </div>
                            <span>→</span>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(request.endDate)}</span>
                            </div>
                          </div>
                        </div>
                        <Badge className={`${statusConfig.bg} ${statusConfig.text} border-0 font-medium px-3 py-1`}>
                          {request.status}
                        </Badge>
                      </div>
                      
                      {request.reason && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Reason:</span> {request.reason}
                          </p>
                        </div>
                      )}
                      
                      {request.adminNotes && (
                        <div className="pt-3 border-t border-gray-200">
                          <p className="text-sm text-gray-600 italic">
                            <span className="font-medium">Admin notes:</span> {request.adminNotes}
                          </p>
                        </div>
                      )}
                    </div>
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

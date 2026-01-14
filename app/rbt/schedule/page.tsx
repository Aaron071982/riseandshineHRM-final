import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SchedulePage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/')
  }

  const user = await validateSession(sessionToken)
  if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
    redirect('/')
  }

  const shifts = await prisma.shift.findMany({
    where: {
      rbtProfileId: user.rbtProfileId,
      startTime: {
        gte: new Date(),
      },
      status: { not: 'CANCELED' },
    },
    orderBy: {
      startTime: 'asc',
    },
  })

  const upcomingThisWeek = shifts.filter(shift => {
    const shiftDate = new Date(shift.startTime)
    const weekFromNow = new Date()
    weekFromNow.setDate(weekFromNow.getDate() + 7)
    return shiftDate <= weekFromNow
  })

  const statusColors: Record<string, { bg: string; text: string }> = {
    SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700' },
    COMPLETED: { bg: 'bg-green-100', text: 'text-green-700' },
    CANCELED: { bg: 'bg-gray-100', text: 'text-gray-700' },
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-400 p-8 shadow-lg">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">My Schedule</h1>
          <p className="text-blue-50 text-lg">View your upcoming shifts</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-hover border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming Shifts</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{shifts.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-blue flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{upcomingThisWeek.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hours</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {shifts.reduce((sum, s) => {
                    const hours = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60)
                    return sum + hours
                  }, 0).toFixed(0)}h
                </p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-purple flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shifts List */}
      <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200/20 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">Upcoming Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          {shifts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 mb-2">No upcoming shifts scheduled</p>
              <p className="text-gray-500">Your shifts will appear here once they&apos;re assigned</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shifts.map((shift) => {
                const statusConfig = statusColors[shift.status] || statusColors.SCHEDULED
                const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60)
                return (
                  <div
                    key={shift.id}
                    className="border-2 border-gray-200 rounded-xl p-5 bg-white hover:shadow-lg transition-all card-hover relative overflow-hidden"
                  >
                    {/* Decorative bubble */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100/30 rounded-full -mr-10 -mt-10" />
                    
                    <div className="relative">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-xl text-gray-900 mb-2">{shift.clientName}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(shift.startTime)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{formatDateTime(shift.startTime).split(', ')[1]} - {formatDateTime(shift.endTime).split(', ')[1]}</span>
                            </div>
                            <div className="font-medium text-gray-700">
                              {hours.toFixed(1)}h
                            </div>
                          </div>
                        </div>
                        <Badge className={`${statusConfig.bg} ${statusConfig.text} border-0 font-medium px-3 py-1`}>
                          {shift.status}
                        </Badge>
                      </div>
                      
                      {shift.locationAddress && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-3 pt-3 border-t border-gray-200">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{shift.locationAddress}</span>
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

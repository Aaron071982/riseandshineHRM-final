import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Clock, Calendar, TrendingUp, User } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AttendancePage() {
  const timeEntries = await prisma.timeEntry.findMany({
    include: {
      rbtProfile: true,
      shift: true,
    },
    orderBy: {
      clockInTime: 'desc',
    },
    take: 50,
  })

  // Calculate statistics
  const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0)
  const uniqueRBTs = new Set(timeEntries.map(e => e.rbtProfileId)).size
  const todayEntries = timeEntries.filter(e => {
    const entryDate = new Date(e.clockInTime).toDateString()
    const today = new Date().toDateString()
    return entryDate === today
  })

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-500 via-green-400 to-emerald-400 p-8 shadow-lg">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Attendance & Hours</h1>
          <p className="text-green-50 text-lg">View time entries and hours worked</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-hover border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hours</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{totalHours.toFixed(1)}h</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Time Entries</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{timeEntries.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-blue flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active RBTs</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{uniqueRBTs}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-purple flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-orange-200 bg-gradient-to-br from-white to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today&apos;s Entries</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{todayEntries.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries List */}
      <Card className="border-2 border-green-100 bg-gradient-to-br from-white to-green-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-green-200/20 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 mb-2">No time entries found</p>
              <p className="text-gray-500">RBTs will appear here once they log their hours</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-2 border-gray-200 rounded-xl p-5 bg-white hover:shadow-lg transition-all card-hover relative overflow-hidden"
                >
                  {/* Decorative bubble */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-green-100/30 rounded-full -mr-10 -mt-10" />
                  
                  <div className="relative grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                    <div className="md:col-span-2">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">
                        {entry.rbtProfile.firstName} {entry.rbtProfile.lastName}
                      </h3>
                      <div className="text-sm text-gray-600">
                        {formatDate(entry.clockInTime)}
                      </div>
                    </div>
                    
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-1">Clock In</div>
                      <div className="text-gray-600">{formatDateTime(entry.clockInTime)}</div>
                    </div>
                    
                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-1">Clock Out</div>
                      <div className="text-gray-600">
                        {entry.clockOutTime ? formatDateTime(entry.clockOutTime) : <span className="text-orange-600">In Progress</span>}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {entry.totalHours ? `${entry.totalHours.toFixed(2)}h` : '—'}
                      </div>
                      <div className="text-xs text-gray-500">Total Hours</div>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      <div className="font-medium mb-1">Source</div>
                      <div className="text-xs">{entry.source.replace(/_/g, ' ')}</div>
                      {entry.shift && (
                        <div className="text-xs mt-1">{entry.shift.clientName}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Plus, Users, Calendar, FileCheck, Clock, TrendingUp, UserPlus, CheckCircle } from 'lucide-react'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export default async function AdminDashboard() {
  // Get current admin user
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const user = sessionToken ? await validateSession(sessionToken) : null
  const adminEmail = user?.email || ''

  // Fetch statistics with error handling
  let totalCandidates = 0
  let candidatesByStatus: Array<{ status: string; _count: number }> = []
  let upcomingInterviews: any[] = []
  let recentHires: any[] = []
  let pendingOnboarding: Array<{ rbtProfileId: string; _count: { id: number } }> = []

  try {
    const results = await Promise.all([
    prisma.rBTProfile.count(),
    prisma.rBTProfile.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.interview.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          gte: new Date(),
        },
        interviewerName: adminEmail, // Filter by current admin's email
      },
      include: {
        rbtProfile: true,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
      take: 5,
    }),
    prisma.rBTProfile.findMany({
      where: {
        status: 'HIRED',
      },
      include: {
        user: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 5,
    }),
      prisma.onboardingTask.groupBy({
        by: ['rbtProfileId'],
        where: {
          isCompleted: false,
        },
        _count: {
          id: true,
        },
      }),
    ])

    totalCandidates = results[0]
    candidatesByStatus = results[1]
    upcomingInterviews = results[2]
    recentHires = results[3]
    pendingOnboarding = results[4]
  } catch (error: any) {
    console.error('❌ Database connection error in AdminDashboard:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    })
    
    // Check if it's a Prisma connection error
    if (error.code === 'P1001' || error.message?.includes('Can\'t reach database server')) {
      console.error('🔴 Prisma P1001: Cannot reach database server')
      console.error('   DATABASE_URL host:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'NOT SET')
      console.error('   This usually means:')
      console.error('   1. DATABASE_URL is incorrect or not set in Vercel')
      console.error('   2. Supabase network restrictions are blocking Vercel IPs')
      console.error('   3. Database server is down or unreachable')
      throw new Error('Database connection failed. Please check your DATABASE_URL configuration and Supabase network settings.')
    }
    
    // Re-throw other errors
    throw error
  }

  const statusCounts = candidatesByStatus.reduce((acc, item) => {
    acc[item.status] = item._count
    return acc
  }, {} as Record<string, number>)

  const pendingOnboardingCount = pendingOnboarding.length

  return (
    <div className="space-y-8">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-orange-400 to-orange-300 p-8 shadow-lg">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/15 rounded-full bubble-animation-delayed-2" />
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-orange-50 text-lg">Welcome back! Here&apos;s an overview of your HRM system.</p>
          </div>
          <Link href="/admin/rbts/new">
            <Button className="bg-white text-primary hover:bg-orange-50 border-0 shadow-lg rounded-xl px-6 py-6 text-base font-semibold shine-effect">
              <Plus className="w-5 h-5 mr-2" />
              Add New RBT / Candidate
            </Button>
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-hover border-2 border-orange-200 bg-gradient-to-br from-white to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Candidates</p>
                <p className="text-3xl font-bold text-gradient mt-2">{totalCandidates}</p>
                <p className="text-xs text-gray-500 mt-1">All time</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center glow-effect">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hired RBTs</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{statusCounts['HIRED'] || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Active RBTs</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center glow-effect">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming Interviews</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{upcomingInterviews.length}</p>
                <p className="text-xs text-gray-500 mt-1">Next 5 interviews</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-blue flex items-center justify-center glow-effect">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Onboarding</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{pendingOnboardingCount}</p>
                <p className="text-xs text-gray-500 mt-1">Incomplete tasks</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-purple flex items-center justify-center glow-effect">
                <FileCheck className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Candidates by Status */}
      <Card className="border-2 border-orange-100 bg-gradient-to-br from-white to-orange-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-200/20 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">Candidates by Status</CardTitle>
          <CardDescription>Distribution of candidates across the hiring pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 relative">
            {['NEW', 'REACH_OUT', 'TO_INTERVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED', 'REJECTED'].map((status) => {
              const count = statusCounts[status] || 0
              const statusConfig = {
                NEW: { color: 'text-gray-600', bg: 'bg-gray-100' },
                REACH_OUT: { color: 'text-blue-600', bg: 'bg-blue-100' },
                TO_INTERVIEW: { color: 'text-yellow-600', bg: 'bg-yellow-100' },
                INTERVIEW_SCHEDULED: { color: 'text-purple-600', bg: 'bg-purple-100' },
                INTERVIEW_COMPLETED: { color: 'text-indigo-600', bg: 'bg-indigo-100' },
                HIRED: { color: 'text-green-600', bg: 'bg-green-100' },
                REJECTED: { color: 'text-red-600', bg: 'bg-red-100' },
              }[status] || { color: 'text-gray-600', bg: 'bg-gray-100' }
              
              return (
                <div key={status} className={`text-center p-4 rounded-xl ${statusConfig.bg} border-2 border-transparent hover:border-${statusConfig.color.split('-')[1]}-300 transition-all`}>
                  <div className={`text-3xl font-bold ${statusConfig.color} mb-1`}>
                    {count}
                  </div>
                  <div className="text-xs font-medium text-gray-700 mt-1">
                    {status.replace(/_/g, ' ')}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Interviews */}
        <Card className="border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 rounded-full -mr-16 -mt-16 bubble-animation-delayed" />
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Upcoming Interviews
            </CardTitle>
            <CardDescription>Next scheduled interviews</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingInterviews.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 font-medium">No upcoming interviews</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingInterviews.map((interview) => (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between p-4 border-2 border-blue-200 rounded-xl bg-white hover:shadow-md transition-all card-hover"
                  >
                    <div>
                      <div className="font-bold text-gray-900">
                        {interview.rbtProfile.firstName} {interview.rbtProfile.lastName}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {new Date(interview.scheduledAt).toLocaleString()} • {interview.interviewerName}
                      </div>
                    </div>
                    <Badge className="gradient-blue text-white border-0">{interview.status}</Badge>
                  </div>
                ))}
                <Link href="/admin/interviews">
                  <Button variant="outline" className="w-full mt-4 border-2 border-blue-200 hover:bg-blue-50 rounded-xl">
                    View All Interviews
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Hired */}
        <Card className="border-2 border-green-100 bg-gradient-to-br from-white to-green-50/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 rounded-full -mr-16 -mt-16 bubble-animation-delayed-2" />
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Recently Hired RBTs
            </CardTitle>
            <CardDescription>Latest additions to the team</CardDescription>
          </CardHeader>
          <CardContent>
            {recentHires.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 font-medium">No recently hired RBTs</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentHires.map((rbt) => (
                  <div
                    key={rbt.id}
                    className="flex items-center justify-between p-4 border-2 border-green-200 rounded-xl bg-white hover:shadow-md transition-all card-hover"
                  >
                    <div>
                      <div className="font-bold text-gray-900">
                        {rbt.firstName} {rbt.lastName}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {rbt.email} • Hired {formatDate(rbt.updatedAt)}
                      </div>
                    </div>
                    <Link href={`/admin/rbts/${rbt.id}`}>
                      <Button className="gradient-green text-white border-0 rounded-lg px-4 shine-effect">
                        View →
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

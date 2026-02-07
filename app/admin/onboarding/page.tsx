import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileCheck, TrendingUp, Clock, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OnboardingPage() {
  type RBTWithTasks = Prisma.RBTProfileGetPayload<{ include: { user: true; onboardingTasks: true } }>
  let hiredRBTs: RBTWithTasks[] = []
  try {
    hiredRBTs = await prisma.rBTProfile.findMany({
      where: {
        status: 'HIRED',
      },
      include: {
        user: true,
        onboardingTasks: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })
  } catch (error) {
    console.error('Admin onboarding: failed to load', error)
    try {
      const rbts = await prisma.$queryRaw<
        Array<{ id: string; firstName: string; lastName: string; email: string | null; phoneNumber: string; updatedAt: Date }>
      >`SELECT id, "firstName", "lastName", email, "phoneNumber", "updatedAt" FROM rbt_profiles WHERE status = 'HIRED' ORDER BY "updatedAt" DESC`
      const tasks = await prisma.$queryRaw<
        Array<{ rbtProfileId: string; taskType: string; isCompleted: boolean }>
      >`SELECT "rbtProfileId", "taskType", "isCompleted" FROM onboarding_tasks`
      const tasksByRbt = tasks.reduce((acc, t) => {
        if (!acc[t.rbtProfileId]) acc[t.rbtProfileId] = []
        acc[t.rbtProfileId].push({ taskType: t.taskType, isCompleted: t.isCompleted })
        return acc
      }, {} as Record<string, Array<{ taskType: string; isCompleted: boolean }>>)
      hiredRBTs = rbts.map((r) => ({
        ...r,
        user: {} as any,
        onboardingTasks: (tasksByRbt[r.id] || []).map((t) => ({
          taskType: t.taskType,
          isCompleted: t.isCompleted,
        })) as any,
      })) as RBTWithTasks[]
    } catch (rawErr) {
      console.error('Admin onboarding: raw fallback failed', rawErr)
    }
  }

  const rbtOnboardingData = hiredRBTs.map((rbt) => {
    const tasks = rbt.onboardingTasks
    const completed = tasks.filter((t) => t.isCompleted).length
    const total = tasks.length
    const docsUploaded = tasks.filter(
      (t) => t.taskType === 'UPLOAD_SIGNED_DOC' && t.isCompleted
    ).length
    const videosCompleted = tasks.filter(
      (t) => t.taskType === 'VIDEO_COURSE' && t.isCompleted
    ).length
    const totalVideos = tasks.filter((t) => t.taskType === 'VIDEO_COURSE').length

    return {
      id: rbt.id,
      name: `${rbt.firstName} ${rbt.lastName}`,
      email: rbt.email,
      phone: rbt.phoneNumber,
      progress: total > 0 ? `${completed}/${total}` : '0/0',
      docsUploaded: docsUploaded > 0 ? 'Yes' : 'No',
      videosCompleted: `${videosCompleted}/${totalVideos}`,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  })

  const totalRBTs = rbtOnboardingData.length
  const completedOnboarding = rbtOnboardingData.filter(r => r.percentage === 100).length
  const inProgress = rbtOnboardingData.filter(r => r.percentage > 0 && r.percentage < 100).length
  const notStarted = rbtOnboardingData.filter(r => r.percentage === 0).length

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 via-purple-400 to-indigo-400 p-8 shadow-lg">
        {/* Decorative bubbles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Onboarding</h1>
          <p className="text-purple-50 text-lg">Track onboarding progress for hired RBTs</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-hover border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total RBTs</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{totalRBTs}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-purple flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-green-200 bg-gradient-to-br from-white to-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{completedOnboarding}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-yellow-200 bg-gradient-to-br from-white to-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{inProgress}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-yellow flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Not Started</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{notStarted}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-blue flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Progress Table */}
      <Card className="border-2 border-purple-100 bg-gradient-to-br from-white to-purple-50/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-200/20 rounded-full -mr-20 -mt-20 bubble-animation" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">Onboarding Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {rbtOnboardingData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 mb-2">No RBTs in onboarding phase</p>
              <p className="text-gray-500">Hire candidates to start tracking onboarding progress</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rbtOnboardingData.map((rbt) => (
                <div
                  key={rbt.id}
                  className="border-2 border-gray-200 rounded-xl p-5 bg-white hover:shadow-lg transition-all card-hover relative overflow-hidden"
                >
                  {/* Decorative bubble */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-purple-100/30 rounded-full -mr-10 -mt-10" />
                  
                  <div className="relative grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                    <div className="md:col-span-2">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{rbt.name}</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>{rbt.phone}</div>
                        {rbt.email && <div>{rbt.email}</div>}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-sm font-bold text-gray-900">{rbt.progress}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            rbt.percentage === 100
                              ? 'gradient-green'
                              : rbt.percentage > 0
                              ? 'gradient-yellow'
                              : 'bg-gray-300'
                          }`}
                          style={{ width: `${rbt.percentage}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{rbt.percentage}% complete</div>
                    </div>
                    
                    <div className="text-center">
                      <Badge className={rbt.docsUploaded === 'Yes' ? 'bg-green-100 text-green-700 border-0' : 'bg-gray-100 text-gray-700 border-0'}>
                        {rbt.docsUploaded}
                      </Badge>
                      <div className="text-xs text-gray-500 mt-1">HIPAA Docs</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-700">{rbt.videosCompleted}</div>
                      <div className="text-xs text-gray-500">Videos</div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Link href={`/admin/rbts/${rbt.id}`}>
                        <Button variant="outline" size="sm" className="rounded-lg border-2 hover:bg-purple-50">
                          View →
                        </Button>
                      </Link>
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

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileCheck, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import OnboardingAdminActions from '@/components/admin/OnboardingAdminActions'

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
      {/* Header with gradient banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Onboarding</h1>
          <p className="text-emerald-50 text-lg">Track onboarding progress for hired RBTs</p>
        </div>
      </div>

      {/* Stats Cards with colored borders and gradient icons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-hover border-2 border-purple-200 dark:border-purple-800/40 bg-gradient-to-br from-white to-purple-50 dark:from-[var(--bg-elevated)] dark:to-purple-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Total RBTs</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-[var(--status-onboarding-text)] mt-2">{totalRBTs}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-purple flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-green-200 dark:border-green-800/40 bg-gradient-to-br from-white to-green-50 dark:from-[var(--bg-elevated)] dark:to-green-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Completed</p>
                <p className="text-3xl font-bold text-green-600 dark:text-[var(--status-hired-text)] mt-2">{completedOnboarding}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-green flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-amber-200 dark:border-amber-800/40 bg-gradient-to-br from-white to-amber-50 dark:from-[var(--bg-elevated)] dark:to-amber-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">In Progress</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-[var(--status-warning-text)] mt-2">{inProgress}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-yellow flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-2 border-blue-200 dark:border-blue-800/40 bg-gradient-to-br from-white to-blue-50 dark:from-[var(--bg-elevated)] dark:to-blue-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Not Started</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-[var(--status-interview-text)] mt-2">{notStarted}</p>
              </div>
              <div className="h-12 w-12 rounded-full gradient-blue flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <OnboardingAdminActions />

      {/* Onboarding Progress Table */}
      <Card className="border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Onboarding Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {rbtOnboardingData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-gray-700 dark:text-[var(--text-secondary)] mb-2">No RBTs in onboarding phase</p>
              <p className="text-gray-500 dark:text-[var(--text-tertiary)]">Hire candidates to start tracking onboarding progress</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rbtOnboardingData.map((rbt) => (
                <div
                  key={rbt.id}
                  className="border border-gray-200 dark:border-[var(--border-subtle)] rounded-lg p-5 bg-gray-50 dark:bg-[var(--bg-elevated)] dark:hover:bg-[var(--bg-elevated-hover)]"
                >
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                    <div className="md:col-span-2">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-[var(--text-primary)] mb-1">{rbt.name}</h3>
                      <div className="text-sm md:text-base text-gray-600 dark:text-white space-y-1">
                        <div>{rbt.phone}</div>
                        {rbt.email && <div>{rbt.email}</div>}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-white">Progress</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-[var(--text-primary)]">{rbt.progress}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-[var(--bg-input)] rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            rbt.percentage === 100
                              ? 'bg-green-500'
                              : rbt.percentage > 0
                              ? 'bg-amber-500'
                              : 'bg-gray-300 dark:bg-[var(--bg-input)]'
                          }`}
                          style={{ width: `${rbt.percentage}%` }}
                        />
                      </div>
                      <div className="text-sm text-gray-500 dark:text-white mt-1">{rbt.percentage}% complete</div>
                    </div>
                    <div className="text-center">
                      <Badge className={rbt.docsUploaded === 'Yes' ? 'bg-green-100 text-green-700 dark:bg-[var(--status-hired-bg)] dark:text-[var(--status-hired-text)] border-0' : 'bg-gray-100 text-gray-700 dark:bg-[var(--bg-elevated)] dark:text-white border-0'}>
                        {rbt.docsUploaded}
                      </Badge>
                      <div className="text-sm text-gray-500 dark:text-white mt-1">HIPAA Docs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">{rbt.videosCompleted}</div>
                      <div className="text-sm text-gray-500 dark:text-white">Videos</div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Link href={`/admin/rbts/${rbt.id}`}>
                        <Button variant="outline" size="sm" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)] dark:hover:border-[var(--orange-primary)] dark:hover:text-[var(--orange-primary)]">
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

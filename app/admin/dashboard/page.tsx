import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import TrackedLink from '@/components/tracking/TrackedLink'
import { Plus, Shield } from 'lucide-react'
import { cookies } from 'next/headers'
import { validateSession, isSuperAdmin, isExecutiveAdmin } from '@/lib/auth'
import SuperAdminCreateAdmin from '@/components/admin/SuperAdminCreateAdmin'
import SuperAdminUserManagement from '@/components/admin/SuperAdminUserManagement'
import DashboardAnalytics from '@/components/admin/DashboardAnalytics'
import ExecutivePayrollPanel from '@/components/admin/ExecutivePayrollPanel'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboard() {
  let user: Awaited<ReturnType<typeof validateSession>> = null
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    user = sessionToken ? await validateSession(sessionToken) : null
  } catch (e) {
    console.error('Admin dashboard: session check failed', e)
  }
  const adminEmail = user?.email || ''
  const executive = isExecutiveAdmin(user)

  return (
    <div className="space-y-8">
      <div
        className={
          executive
            ? 'relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 p-8 shadow-lg'
            : 'relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 p-8 shadow-lg'
        }
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              {executive ? 'Executive Dashboard' : 'Admin Dashboard'}
            </h1>
            <p className={executive ? 'text-indigo-100 text-lg' : 'text-orange-50 text-lg'}>
              {executive
                ? 'Operations overview — hiring, payroll, and team health.'
                : "Welcome back! Here's an overview of your system."}
            </p>
          </div>
          <TrackedLink href="/admin/rbts/new">
            <Button
              className={
                executive
                  ? 'rounded-xl px-6 py-6 text-base font-semibold bg-white/90 text-indigo-800 hover:bg-white border-0 shadow-md'
                  : 'rounded-xl px-6 py-6 text-base font-semibold bg-white/90 text-orange-700 hover:bg-white border-0 shadow-md'
              }
            >
              <Plus className="w-5 h-5 mr-2" />
              Add New RBT / Candidate
            </Button>
          </TrackedLink>
        </div>
      </div>

      {executive && (
        <Suspense fallback={<div className="py-8 text-center text-gray-500">Loading payroll…</div>}>
          <ExecutivePayrollPanel />
        </Suspense>
      )}

      <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading analytics...</div>}>
        <DashboardAnalytics />
      </Suspense>

      {adminEmail && isSuperAdmin(adminEmail) && (
        <Card className="border-2 border-purple-200 dark:border-purple-800/40 bg-white dark:bg-[var(--bg-elevated)]">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600 dark:text-[var(--status-onboarding-text)]" />
              Admin Management
            </CardTitle>
            <CardDescription className="dark:text-[var(--text-tertiary)]">
              Add and remove admin users. Only you and kazi@siyam.nyc can manage admins.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SuperAdminUserManagement />
              </div>
              <div>
                <SuperAdminCreateAdmin />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

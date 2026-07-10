import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import { canAccessSchedule } from '@/lib/schedule/access'
import ScheduleLayout from '@/components/schedule/ScheduleLayout'

export const dynamic = 'force-dynamic'

export default async function ScheduleSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user || !(await canAccessSchedule(user))) {
    redirect('/login?session_expired=1')
  }

  return (
    <ScheduleLayout userName={user.name ?? user.email ?? 'Scheduler'}>
      {children}
    </ScheduleLayout>
  )
}

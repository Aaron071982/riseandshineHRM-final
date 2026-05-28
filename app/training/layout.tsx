import { cookies } from 'next/headers'
import { validateSession, canAccessTrainingPortal } from '@/lib/auth'
import { redirect } from 'next/navigation'
import TrainingLayout from '@/components/training/TrainingLayout'

export const dynamic = 'force-dynamic'

export default async function TrainingSectionLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user || !canAccessTrainingPortal(user)) {
    redirect('/login?session_expired=1')
  }

  return (
    <TrainingLayout userName={user.name ?? user.email ?? 'Trainer'}>{children}</TrainingLayout>
  )
}

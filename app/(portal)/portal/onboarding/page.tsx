import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import BcbaOnboardingWizard from '@/components/portal/BcbaOnboardingWizard'

export const dynamic = 'force-dynamic'

export default async function PortalOnboardingPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')

  const user = await validateSession(token)
  if (!user?.bcbaProfileId || user.role !== 'BCBA') {
    redirect('/portal')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <BcbaOnboardingWizard bcbaProfileId={user.bcbaProfileId} />
    </div>
  )
}

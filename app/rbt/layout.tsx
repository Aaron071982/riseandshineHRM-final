import RBTLayout from '@/components/layout/RBTLayout'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function RBTLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      redirect('/')
    }

    const user = await validateSession(sessionToken)
    // Allow both CANDIDATE and RBT roles to access the portal
    if (!user || !user.rbtProfileId || (user.role !== 'RBT' && user.role !== 'CANDIDATE')) {
      redirect('/')
    }

    return <RBTLayout>{children}</RBTLayout>
  } catch (e) {
    console.error('RBT layout: session validation failed', e)
    redirect('/')
  }
}


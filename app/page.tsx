import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import PublicCareersLandingPage from '@/components/public/PublicCareersLandingPage'

export default async function Home() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (sessionToken) {
    const user = await validateSession(sessionToken)
    if (user) {
      if (user.role === 'ADMIN') {
        redirect('/admin/dashboard')
      } else if (user.role === 'RBT') {
        redirect('/rbt/dashboard')
      }
    }
  }

  return <PublicCareersLandingPage />
}

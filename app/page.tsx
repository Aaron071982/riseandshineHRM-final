import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import PublicCareersLandingPage from '@/components/public/PublicCareersLandingPage'

export default async function Home() {
  try {
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
  } catch (e) {
    console.error('Home: session check failed', e)
    // Treat as no session and show public landing page
  }

  return <PublicCareersLandingPage />
}

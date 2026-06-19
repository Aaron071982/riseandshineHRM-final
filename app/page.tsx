import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { getPostLoginPath } from '@/lib/auth/postLogin'
import PublicCareersLandingPage from '@/components/public/PublicCareersLandingPage'

export const dynamic = 'force-dynamic'

export default async function Home() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (sessionToken) {
      const user = await validateSession(sessionToken)
      if (user) {
        const dest = getPostLoginPath(user.role)
        if (dest) redirect(dest)
      }
    }
  } catch (e) {
    console.error('Home: session check failed', e)
    // Treat as no session and show public landing page
  }

  return <PublicCareersLandingPage />
}

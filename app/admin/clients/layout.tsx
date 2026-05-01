import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession, resolveClientManagerAccess } from '@/lib/auth'

export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const user = token ? await validateSession(token) : null
  if (!user || !(await resolveClientManagerAccess(user))) {
    redirect('/admin/dashboard')
  }
  return <>{children}</>
}

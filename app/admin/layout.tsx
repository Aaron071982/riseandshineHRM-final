import AdminLayout from '@/components/layout/AdminLayout'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminLayoutWrapper({
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
    if (!user || user.role !== 'ADMIN') {
      redirect('/')
    }

    return <AdminLayout>{children}</AdminLayout>
  } catch (e) {
    console.error('Admin layout: session validation failed', e)
    redirect('/')
  }
}


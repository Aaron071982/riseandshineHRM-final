import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import RbtResourcesPage from '@/components/rbt/RbtResourcesPage'

export const dynamic = 'force-dynamic'

export default async function ResourcesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/')
  const user = await validateSession(token)
  if (!user?.rbtProfileId) redirect('/')
  return <RbtResourcesPage rbtProfileId={user.rbtProfileId} />
}

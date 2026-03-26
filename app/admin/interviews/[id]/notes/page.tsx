import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import InterviewNotesPage from '@/components/admin/InterviewNotesPage'

export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')
  const user = await validateSession(token)
  if (!user || user.role !== 'ADMIN') redirect('/login')

  return <InterviewNotesPage interviewId={id} currentUser={{ id: user.id, name: user.name || user.email || 'Admin' }} />
}

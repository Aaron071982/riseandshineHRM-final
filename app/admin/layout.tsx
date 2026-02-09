import AdminLayout from '@/components/layout/AdminLayout'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  let sessionToken: string | undefined
  try {
    const cookieStore = await cookies()
    sessionToken = cookieStore.get('session')?.value
  } catch (e) {
    console.error('Admin layout: failed to read cookies', e)
    redirect('/login?session_error=1')
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3b5b3be0-730f-42a8-8e8a-282e15fc296a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/layout','message':'cookies',data:{hasCookie:!!sessionToken,len:sessionToken?.length??0},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  if (!sessionToken) {
    redirect('/login')
  }

  let user: Awaited<ReturnType<typeof validateSession>>
  try {
    user = await validateSession(sessionToken)
  } catch (e) {
    console.error('Admin layout: session validation failed', e)
    redirect('/login?session_error=1')
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3b5b3be0-730f-42a8-8e8a-282e15fc296a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/layout','message':'after validateSession',data:{userId:user?.id??null,role:user?.role??null,strictAdmin:user?.role==='ADMIN'},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
  if (!user || user.role !== 'ADMIN') {
    redirect('/login?session_expired=1')
  }

  return <AdminLayout>{children}</AdminLayout>
}


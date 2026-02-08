import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AdminSettingsRedirect() {
  redirect('/admin/dashboard')
}

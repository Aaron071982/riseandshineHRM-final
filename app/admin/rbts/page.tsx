import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function RBTPage() {
  redirect('/admin/employees?type=RBT')
}

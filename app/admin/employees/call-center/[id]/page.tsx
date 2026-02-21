import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import StaffHoursLogSection from '@/components/admin/StaffHoursLogSection'

export default async function CallCenterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await prisma.callCenterProfile.findUnique({ where: { id } })
  if (!profile) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/employees?type=CALL_CENTER" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block">
          ← Back to Employees
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">{profile.fullName}</h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)]">Call Center profile</p>
      </div>

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profile.email && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Email:</span> {profile.email}</p>}
          {profile.phone && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Phone:</span> {profile.phone}</p>}
          {profile.title && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Title:</span> {profile.title}</p>}
          {profile.extension && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Extension:</span> {profile.extension}</p>}
          {profile.status && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Status:</span> {profile.status}</p>}
          {profile.notes && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Notes:</span> {profile.notes}</p>}
          <p className="text-xs text-gray-400 dark:text-[var(--text-disabled)]">Updated {formatDate(profile.updatedAt)}</p>
        </CardContent>
      </Card>

      <StaffHoursLogSection employeeType="CALL_CENTER" referenceId={profile.id} />
    </div>
  )
}

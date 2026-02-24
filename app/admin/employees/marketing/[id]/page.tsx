import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import StaffHoursLogSection from '@/components/admin/StaffHoursLogSection'
import EmployeeDeleteSection from '@/components/admin/EmployeeDeleteSection'

export default async function MarketingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await prisma.marketingProfile.findUnique({ where: { id } })
  if (!profile) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/employees?type=MARKETING" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block">
          ← Back to Employees
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">{profile.fullName}</h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)]">Marketing profile</p>
      </div>

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profile.email && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Email:</span> {profile.email}</p>}
          {profile.phone && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Phone:</span> {profile.phone}</p>}
          {profile.title && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Title:</span> {profile.title}</p>}
          {profile.campaigns && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Campaigns:</span> {profile.campaigns}</p>}
          {profile.status && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Status:</span> {profile.status}</p>}
          {profile.notes && <p><span className="text-gray-500 dark:text-[var(--text-tertiary)]">Notes:</span> {profile.notes}</p>}
          <p className="text-xs text-gray-400 dark:text-[var(--text-disabled)]">Updated {formatDate(profile.updatedAt)}</p>
        </CardContent>
      </Card>

      <StaffHoursLogSection employeeType="MARKETING" referenceId={profile.id} />

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-[var(--status-rejected-text)]">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeDeleteSection
            kind="Marketing"
            displayName={profile.fullName}
            email={profile.email}
            deleteApiUrl={`/api/admin/employees/marketing/${profile.id}/delete`}
            redirectHref="/admin/employees?type=MARKETING"
          />
        </CardContent>
      </Card>
    </div>
  )
}

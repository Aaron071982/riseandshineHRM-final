import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import StaffHoursLogSection from '@/components/admin/StaffHoursLogSection'
import EmployeeDeleteSection from '@/components/admin/EmployeeDeleteSection'
import { getBcbaOnboardingProgress } from '@/lib/onboarding/bcbaProgress'

export default async function BCBADetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await prisma.bCBAProfile.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, isActive: true, role: true } } },
  })
  if (!profile) notFound()

  let onboarding: Awaited<ReturnType<typeof getBcbaOnboardingProgress>> | null = null
  try {
    onboarding = await getBcbaOnboardingProgress(profile.id)
  } catch {
    onboarding = null
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/employees?type=BCBA"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block"
        >
          ← Back to Employees
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
          {profile.fullName}
        </h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)]">BCBA profile</p>
      </div>

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profile.email && (
            <p>
              <span className="text-gray-500 dark:text-[var(--text-tertiary)]">Email:</span>{' '}
              {profile.email}
            </p>
          )}
          {profile.phone && (
            <p>
              <span className="text-gray-500 dark:text-[var(--text-tertiary)]">Phone:</span>{' '}
              {profile.phone}
            </p>
          )}
          {profile.user ? (
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-gray-500 dark:text-[var(--text-tertiary)]">Login:</span>
              <Badge className="bg-emerald-100 text-emerald-800 border-0">Portal account</Badge>
              <span className="text-xs text-gray-500">{profile.user.email}</span>
            </p>
          ) : (
            <p className="text-amber-700 text-sm">
              No login linked — re-add with an email to create portal access.
            </p>
          )}
          {profile.certificationNumber && (
            <p>
              <span className="text-gray-500 dark:text-[var(--text-tertiary)]">Certification #:</span>{' '}
              {profile.certificationNumber}
            </p>
          )}
          {profile.certificationExpiresAt && (
            <p>
              <span className="text-gray-500 dark:text-[var(--text-tertiary)]">Cert expires:</span>{' '}
              {formatDate(profile.certificationExpiresAt)}
            </p>
          )}
          <p>
            <span className="text-gray-500 dark:text-[var(--text-tertiary)]">Supervisor:</span>{' '}
            {profile.isSupervisor ? 'Yes' : 'No'}
          </p>
          {profile.preferredRegions && (
            <p>
              <span className="text-gray-500 dark:text-[var(--text-tertiary)]">Regions:</span>{' '}
              {profile.preferredRegions}
            </p>
          )}
          {profile.status && (
            <p>
              <span className="text-gray-500 dark:text-[var(--text-tertiary)]">Status:</span>{' '}
              {profile.status}
            </p>
          )}
          {profile.notes && (
            <p>
              <span className="text-gray-500 dark:text-[var(--text-tertiary)]">Notes:</span>{' '}
              {profile.notes}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-[var(--text-disabled)]">
            Updated {formatDate(profile.updatedAt)}
          </p>
        </CardContent>
      </Card>

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!onboarding || onboarding.totalSteps === 0 ? (
            <p className="text-sm text-gray-500">
              No BCBA onboarding documents yet.{' '}
              <Link href="/admin/onboarding-documents" className="underline text-blue-600">
                Upload templates
              </Link>
            </p>
          ) : (
            <>
              <p className="text-sm">
                Progress:{' '}
                <strong>
                  {onboarding.completedCount}/{onboarding.totalSteps}
                </strong>
                {onboarding.fullyComplete || profile.onboardingCompletedAt ? (
                  <Badge className="ml-2 bg-emerald-100 text-emerald-800 border-0">Complete</Badge>
                ) : null}
              </p>
              <ul className="text-sm space-y-1">
                {onboarding.steps.map((s, i) => (
                  <li key={s.document.id} className="flex items-center gap-2">
                    <span className={s.isComplete ? 'text-emerald-600' : 'text-gray-400'}>
                      {s.isComplete ? '✓' : '○'}
                    </span>
                    <span>
                      {i + 1}. {s.document.title}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <StaffHoursLogSection employeeType="BCBA" referenceId={profile.id} />

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-[var(--status-rejected-text)]">
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeDeleteSection
            kind="BCBA"
            displayName={profile.fullName}
            email={profile.email}
            deleteApiUrl={`/api/admin/employees/bcba/${profile.id}/delete`}
            redirectHref="/admin/employees?type=BCBA"
          />
        </CardContent>
      </Card>
    </div>
  )
}

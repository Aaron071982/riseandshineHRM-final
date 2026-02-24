import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import AddDevTeamMemberForm from '@/components/admin/AddDevTeamMemberForm'
import StaffHoursLogSection from '@/components/admin/StaffHoursLogSection'
import EmployeeDeleteSection from '@/components/admin/EmployeeDeleteSection'

export default async function DevTeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const team = await prisma.devTeam.findUnique({
    where: { id: teamId },
    include: { members: true },
  })
  if (!team) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/employees?type=DEV_TEAM" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block">
          ← Back to Employees
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">{team.name}</h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)]">Dev team · {team.members.length} member{team.members.length !== 1 ? 's' : ''}</p>
      </div>

      {team.description && (
        <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
          <CardContent className="pt-6">
            <p className="text-gray-600 dark:text-[var(--text-tertiary)]">{team.description}</p>
          </CardContent>
        </Card>
      )}

      <AddDevTeamMemberForm teamId={team.id} />

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle>Team members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {team.members.length === 0 ? (
            <p className="text-gray-500 dark:text-[var(--text-tertiary)]">No members yet. Add one above.</p>
          ) : (
            team.members.map((member) => (
              <div key={member.id} className="border-b dark:border-[var(--border-subtle)] pb-6 last:border-0 last:pb-0">
                <div className="mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">{member.fullName}</h4>
                  <div className="flex flex-wrap gap-2 text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                    {member.email && <span>{member.email}</span>}
                    {member.phone && <span>{member.phone}</span>}
                    {member.role && <span>· {member.role}</span>}
                  </div>
                  {member.notes && <p className="text-sm text-gray-500 dark:text-[var(--text-disabled)] mt-1">{member.notes}</p>}
                  <p className="text-xs text-gray-400 dark:text-[var(--text-disabled)]">Updated {formatDate(member.updatedAt)}</p>
                </div>
                <div className="mt-4">
                  <StaffHoursLogSection employeeType="DEV_TEAM_MEMBER" referenceId={member.id} />
                </div>
                <div className="mt-4">
                  <EmployeeDeleteSection
                    kind="Dev Team Member"
                    displayName={member.fullName}
                    email={member.email}
                    deleteApiUrl={`/api/admin/employees/dev-teams/${team.id}/members/${member.id}/delete`}
                    redirectHref={`/admin/employees/teams/${teamId}`}
                    buttonLabel="Delete member"
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-[var(--status-rejected-text)]">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeDeleteSection
            kind="Dev Team"
            displayName={team.name}
            deleteApiUrl={`/api/admin/employees/dev-teams/${team.id}/delete`}
            redirectHref="/admin/employees?type=DEV_TEAM"
          />
        </CardContent>
      </Card>
    </div>
  )
}

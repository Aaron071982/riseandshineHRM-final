import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { validateSession, isAdmin } from '@/lib/auth'
import { canAccessDocumentsEmail } from '@/lib/constants'
import { loadI9ComplianceReport, type HireDateSource, type I9ReportRow } from '@/lib/compliance/i9Report'
import { I9_SECTION2_DEADLINE_BUSINESS_DAYS } from '@/lib/onboarding/catalog'
import AdminI9OutreachPanel from '@/components/admin/AdminI9OutreachPanel'

export const dynamic = 'force-dynamic'

const HIRE_SOURCE_LABEL: Record<HireDateSource, string> = {
  RECORDED: '',
  AUDIT_LOG: 'from status history',
  ONBOARDING_START: 'est. from onboarding start',
  UNKNOWN: 'unknown',
}

function fmt(d: Date | null): string {
  return d ? d.toLocaleDateString('en-US', { timeZone: 'America/New_York' }) : '—'
}

function severity(r: I9ReportRow): number {
  if (r.workingWithoutSection1) return 0
  if (r.section2Overdue) return 1
  if (r.status !== 'COMPLETE') return 2
  return 3
}

export default async function I9ComplianceReportPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) redirect('/login')
  const user = await validateSession(token)
  if (!user || !isAdmin(user) || !canAccessDocumentsEmail(user.email)) {
    redirect('/admin/dashboard')
  }

  const rows = (await loadI9ComplianceReport()).sort(
    (a, b) => severity(a) - severity(b) || a.name.localeCompare(b.name)
  )
  const complete = rows.filter((r) => r.status === 'COMPLETE').length
  const overdue = rows.filter((r) => r.section2Overdue).length
  const workingWithout = rows.filter((r) => r.workingWithoutSection1).length
  const legacy = rows.filter((r) => r.legacyI9CompletionId && r.status !== 'COMPLETE').length

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/onboarding" className="text-sm text-orange-600 hover:underline">
          ← Onboarding
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
          Form I-9 compliance
        </h1>
        <p className="text-sm text-gray-600 dark:text-[var(--text-secondary)]">
          Section 1 (employee) is due by the first day of work. Section 2 (employer document review) is
          due within {I9_SECTION2_DEADLINE_BUSINESS_DAYS} business days of hire. Business days exclude
          weekends only, not federal holidays.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Hired staff" value={rows.length} />
        <Stat label="I-9 complete" value={complete} />
        <Stat label="Section 2 overdue" value={overdue} danger={overdue > 0} />
        <Stat label="Active, no Section 1" value={workingWithout} danger={workingWithout > 0} />
        <Stat label="Legacy I-9 to verify" value={legacy} />
      </div>

      <AdminI9OutreachPanel />

      <Card>
        <CardHeader>
          <CardTitle>Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Stage</th>
                  <th className="py-2 pr-4">Hire date</th>
                  <th className="py-2 pr-4">Days since hire</th>
                  <th className="py-2 pr-4">Section 1</th>
                  <th className="py-2 pr-4">Section 2</th>
                  <th className="py-2 pr-4">Files</th>
                  <th className="py-2 pr-4">Flags</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.rbtProfileId}
                    className={`border-b border-gray-100 ${
                      r.section2Overdue || r.workingWithoutSection1 ? 'bg-red-50/60 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-gray-500">{r.email ?? '—'}</div>
                    </td>
                    <td className="py-3 pr-4 text-xs">{r.postHireStage?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="py-3 pr-4">
                      {fmt(r.hireDate)}
                      {HIRE_SOURCE_LABEL[r.hireDateSource] && (
                        <div className="text-xs text-gray-500">{HIRE_SOURCE_LABEL[r.hireDateSource]}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {r.calendarDaysSinceHire ?? '—'}
                      {r.businessDaysSinceHire != null && (
                        <div className="text-xs text-gray-500">{r.businessDaysSinceHire} business</div>
                      )}
                    </td>
                    <td className="py-3 pr-4">{fmt(r.section1CompletedAt)}</td>
                    <td className="py-3 pr-4">{fmt(r.section2CompletedAt)}</td>
                    <td className="py-3 pr-4">
                      {r.i9DocumentsOnFile > 0 ? `${r.i9DocumentsOnFile} I-9` : '—'}
                      {r.legacyI9CompletionId && (
                        <div>
                          <a
                            href={`/api/admin/rbts/${r.rbtProfileId}/documents/completion/${r.legacyI9CompletionId}/download?inline=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-orange-600 hover:underline"
                          >
                            Legacy I-9 (verify)
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {r.workingWithoutSection1 && <Badge variant="destructive">Active, no Section 1</Badge>}
                        {r.section2Overdue && <Badge variant="destructive">Section 2 overdue</Badge>}
                        {r.status === 'COMPLETE' && <Badge className="bg-green-600">Complete</Badge>}
                        {r.hireDateSource === 'UNKNOWN' && <Badge variant="outline">No hire date</Badge>}
                      </div>
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/rbts/${r.rbtProfileId}`}
                        className="text-sm text-orange-600 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-2xl font-bold ${danger ? 'text-red-600' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileCheck, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { getOnboardingProgress } from '@/lib/onboarding/progress'
import { RBT_VISIBLE_STEPS } from '@/lib/onboarding/catalog'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const hiredRBTs = await prisma.rBTProfile.findMany({
    where: { status: 'HIRED' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      updatedAt: true,
      tierACompletedAt: true,
      tierBCompletedAt: true,
      fullyActivatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  const rows = await Promise.all(
    hiredRBTs.map(async (rbt) => {
      let progress
      try {
        progress = await getOnboardingProgress(rbt.id)
      } catch {
        progress = null
      }
      const tierAPct =
        progress && progress.tierATotal > 0
          ? Math.round((progress.tierACompleted / progress.tierATotal) * 100)
          : 0
      const tierBPct =
        progress && progress.tierBTotal > 0
          ? Math.round((progress.tierBCompleted / progress.tierBTotal) * 100)
          : 0
      const overallPct = progress
        ? Math.round((progress.completedCount / RBT_VISIBLE_STEPS) * 100)
        : 0
      const stalled =
        !progress?.fullyActivated &&
        Date.now() - rbt.updatedAt.getTime() > 72 * 60 * 60 * 1000

      return {
        id: rbt.id,
        name: `${rbt.firstName} ${rbt.lastName}`,
        email: rbt.email,
        phone: rbt.phoneNumber,
        tierAPct,
        tierBPct,
        overallPct,
        status: progress?.fullyActivated
          ? 'Complete'
          : progress?.tierAComplete
            ? 'Tier B in progress'
            : overallPct > 0
              ? 'In progress'
              : 'Not started',
        stalled,
        activated: !!rbt.fullyActivatedAt,
      }
    })
  )

  const completed = rows.filter((r) => r.activated).length
  const inProgress = rows.filter((r) => !r.activated && r.overallPct > 0).length
  const notStarted = rows.filter((r) => !r.activated && r.overallPct === 0).length
  const stalledCount = rows.filter((r) => r.stalled).length

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-400 p-8 shadow-lg">
        <h1 className="text-4xl font-bold text-white mb-2">Onboarding</h1>
        <p className="text-emerald-50 text-lg">32-step onboarding — Tier A / Tier B / Activation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Hired RBTs" value={rows.length} icon={<FileCheck className="h-6 w-6 text-white" />} />
        <StatCard label="Fully activated" value={completed} icon={<CheckCircle className="h-6 w-6 text-white" />} />
        <StatCard label="In progress" value={inProgress} icon={<Clock className="h-6 w-6 text-white" />} />
        <StatCard label="Not started" value={notStarted} icon={<TrendingUp className="h-6 w-6 text-white" />} />
        <StatCard label="Stalled 72h+" value={stalledCount} icon={<Clock className="h-6 w-6 text-white" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding status</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">No hired RBTs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Tier A</th>
                    <th className="py-2 pr-4">Tier B</th>
                    <th className="py-2 pr-4">Overall</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-gray-500">{r.email}</div>
                      </td>
                      <td className="py-3 pr-4">{r.tierAPct}%</td>
                      <td className="py-3 pr-4">{r.tierBPct}%</td>
                      <td className="py-3 pr-4">{r.overallPct}%</td>
                      <td className="py-3 pr-4">
                        <Badge variant={r.stalled ? 'destructive' : 'secondary'}>{r.status}</Badge>
                      </td>
                      <td className="py-3">
                        <Link href={`/admin/rbts/${r.id}`}>
                          <Button size="sm" variant="outline">
                            Documents
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-emerald-600 flex items-center justify-center">{icon}</div>
      </CardContent>
    </Card>
  )
}

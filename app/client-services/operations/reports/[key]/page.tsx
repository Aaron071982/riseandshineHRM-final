import { redirect } from 'next/navigation'
import { getClientServicesPageUser } from '@/lib/crm/access'
import { canAccessOperations } from '@/lib/operations/access'
import { getReportDefinition } from '@/lib/operations/reports'
import { ReportPageClient } from '@/components/crm/operations/ReportPageClient'

export const dynamic = 'force-dynamic'

export default async function OperationsReportPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const user = await getClientServicesPageUser()
  if (!user) redirect('/client-services')
  if (!canAccessOperations(user)) redirect('/client-services')

  const { key } = await params
  if (!getReportDefinition(key)) redirect('/client-services/operations')

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <ReportPageClient reportKey={key} />
    </div>
  )
}

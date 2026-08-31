import { notFound, redirect } from 'next/navigation'
import { CaseCoordinationPrintView } from '@/components/crm/caseCoordination/CaseCoordinationPrintView'
import { loadCaseCoordinationById } from '@/lib/crm/caseCoordination/load'
import {
  assertCanViewCaseCoordination,
  canViewCaseCoordination,
} from '@/lib/crm/caseCoordination/access'
import {
  assertCanViewClient,
  getClientServicesUser,
} from '@/lib/crm/access'
import { auditCaseCoordinationAction } from '@/lib/crm/caseCoordination/audit'
import { headers } from 'next/headers'
import { getClientIpFromHeaders } from '@/lib/client-ip'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string; recordId: string }>
}

export default async function CaseCoordinationPrintPage({ params }: Props) {
  const { id: clientId, recordId } = await params
  const user = await getClientServicesUser()
  if (!canViewCaseCoordination(user)) redirect('/client-services')

  await assertCanViewClient(user, clientId)
  assertCanViewCaseCoordination(user)

  const loaded = await loadCaseCoordinationById(recordId, clientId)
  if (!loaded?.document) notFound()

  const hdrs = await headers()
  await auditCaseCoordinationAction({
    userId: user.id,
    serviceClientId: clientId,
    action: 'PRINT',
    ip: getClientIpFromHeaders(hdrs),
  })

  return (
    <CaseCoordinationPrintView
      clientId={clientId}
      recordId={recordId}
      document={loaded.document}
      status={loaded.record.status}
    />
  )
}

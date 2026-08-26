import { redirect } from 'next/navigation'

export default async function CrmOperationsReportRedirect({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  redirect(`/client-services/operations/reports/${key}`)
}

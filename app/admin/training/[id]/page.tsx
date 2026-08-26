import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminTrainingModuleRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/client-services/training/manage/${id}`)
}

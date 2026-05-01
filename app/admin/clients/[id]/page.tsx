import ClientProfilePage from '@/components/admin/client-management/ClientProfilePage'

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Client profile</h1>
      </div>
      <ClientProfilePage clientId={id} />
    </div>
  )
}

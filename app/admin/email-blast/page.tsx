import EmailBlastClient from '@/components/admin/EmailBlastClient'

export const dynamic = 'force-dynamic'

export default function AdminEmailBlastPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Email Blast</h1>
        <p className="text-muted-foreground mt-1">
          One-time manual campaigns. Review recipients and preview before sending.
        </p>
      </div>
      <EmailBlastClient />
    </div>
  )
}

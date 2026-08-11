import PublicCompanyDocPage from '@/components/public/PublicCompanyDocPage'

export const dynamic = 'force-dynamic'

export default async function CompanyDocMagicLinkPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <PublicCompanyDocPage token={token} />
}

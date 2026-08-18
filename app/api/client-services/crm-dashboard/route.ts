import { NextResponse } from 'next/server'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { getDashboardKpis } from '@/lib/crm/dashboard'
import { auditClientAction } from '@/lib/crm/access'

export const dynamic = 'force-dynamic'

/**
 * Lightweight CRM KPI JSON for the shell badge.
 * Counts only — no client names. Full named dashboard lives on the home page.
 */
export async function GET() {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const kpis = await getDashboardKpis(auth.user)
  await auditClientAction({
    userId: auth.user.id,
    action: 'CRM_KPI_VIEW',
  })
  return NextResponse.json({ kpis })
}

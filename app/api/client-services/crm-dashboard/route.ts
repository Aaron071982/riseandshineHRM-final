import { NextResponse } from 'next/server'
import { requireClientServicesSession } from '@/lib/client-services/access'
import { loadManagerDashboard } from '@/lib/crm/dashboard'

export const dynamic = 'force-dynamic'

/** Lightweight CRM manager dashboard JSON (KPIs for shell badge, etc.). */
export async function GET() {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const data = await loadManagerDashboard(auth.user)
  return NextResponse.json(data)
}

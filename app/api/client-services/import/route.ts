import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/client-ip'
import {
  requireClientServicesSession,
  isClientServicesFullAccessEmail,
} from '@/lib/client-services/access'
import { logClientAccess } from '@/lib/client-services/audit'
import { importClientsMasterCsv } from '@/lib/client-services/importCsv'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireClientServicesSession()
  if (auth.response) return auth.response
  const { user } = auth

  if (!isClientServicesFullAccessEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden — import requires full access' }, { status: 403 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'CSV file required' }, { status: 400 })
  }

  const text = await file.text()
  const result = await importClientsMasterCsv(text, user.id)

  await logClientAccess({
    userId: user.id,
    action: 'CSV_IMPORT',
    ip: getClientIpFromRequest(request),
  })

  return NextResponse.json({ success: true, ...result })
}

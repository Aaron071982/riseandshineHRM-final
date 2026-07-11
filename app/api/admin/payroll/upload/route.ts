import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { createPayrollRunFromUpload } from '@/lib/payroll/createFromUpload'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const result = await createPayrollRunFromUpload(file, auth.user!)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[payroll/upload]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse payroll register' },
      { status: 400 }
    )
  }
}

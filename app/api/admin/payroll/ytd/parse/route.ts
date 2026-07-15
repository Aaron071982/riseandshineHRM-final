import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { parseYtdBatchPreview } from '@/lib/payroll/createFromYtdImport'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  try {
    const form = await request.formData()
    const files = form.getAll('files')
    const buffers: { name: string; buffer: Buffer }[] = []

    for (const f of files) {
      if (!(f instanceof File)) continue
      if (!f.name.toLowerCase().endsWith('.xls')) {
        return NextResponse.json(
          { error: `Only legacy .xls files are accepted (got ${f.name})` },
          { status: 400 }
        )
      }
      buffers.push({ name: f.name, buffer: Buffer.from(await f.arrayBuffer()) })
    }

    if (buffers.length === 0) {
      return NextResponse.json({ error: 'No .xls files uploaded' }, { status: 400 })
    }

    const { preview } = await parseYtdBatchPreview(buffers)
    return NextResponse.json({ preview })
  } catch (e) {
    console.error('[admin/payroll/ytd/parse]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Parse failed' },
      { status: 500 }
    )
  }
}

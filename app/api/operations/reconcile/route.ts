import { NextRequest, NextResponse } from 'next/server'
import { requireOperationsSession } from '@/lib/auth/operationsAccess'
import { workbookBufferToAoa } from '@/lib/artemis/excel'
import { ingest, DEFAULT_RATES } from '@/lib/artemis/parse'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireOperationsSession()
  if (auth.response) return auth.response

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 422 })
  }

  const file = form.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 422 })
  }

  const name = file instanceof File ? file.name : 'upload.xlsx'
  const buf = Buffer.from(await file.arrayBuffer())

  if (buf.length === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 422 })
  }

  try {
    const aoa = await workbookBufferToAoa(buf)
    const rowCount = aoa.length
    const { sessions, hasRealMoney, source } = ingest(aoa, DEFAULT_RATES)

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: 'No sessions found — check that this is a Session Reconciliation export' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      sessions,
      hasRealMoney,
      source,
      rowCount,
      fileName: name,
    })
  } catch (err) {
    console.error('[operations/reconcile]', err)
    return NextResponse.json({ error: 'Failed to parse spreadsheet' }, { status: 422 })
  }
}

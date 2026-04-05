import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { runRetroactiveSignatureAudit } from '@/lib/retroactive-signature-audit'

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'

  try {
    const result = await runRetroactiveSignatureAudit({ dryRun })
    if (result.dryRun) {
      return NextResponse.json({
        dryRun: true,
        scanned: result.scanned,
        wouldCreate: result.wouldCreate,
        acknowledgments: result.acknowledgments,
        fillablePdfs: result.fillablePdfs,
      })
    }
    return NextResponse.json({
      dryRun: false,
      scanned: result.scanned,
      created: result.created,
      acknowledgments: result.acknowledgments,
      fillablePdfs: result.fillablePdfs,
    })
  } catch (e) {
    console.error('[audit-existing-signatures]', e)
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 })
  }
}

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { validateSession, isBillingManager } from '@/lib/auth'
import { generatePayStubPdf } from '@/lib/payroll/generatePayStub'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Generate (or regenerate) a pay stub PDF for a statement.
 * Billing managers only. Stores PDF in private payroll-statements bucket.
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await validateSession(token)
  if (!user || !isBillingManager(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await generatePayStubPdf({
      payStatementId: id,
      actorUserId: user.id,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[payroll-stub] generate', err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Generate failed',
      },
      { status: 400 }
    )
  }
}

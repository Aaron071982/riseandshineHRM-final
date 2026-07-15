import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Return a published run to DRAFT so matches / entries can be edited again. */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id } })
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (run.status !== 'PUBLISHED') {
    return NextResponse.json(
      { error: 'Only published runs can be reopened for editing' },
      { status: 400 }
    )
  }

  const updated = await prisma.payrollRun.update({
    where: { id: params.id },
    data: { status: 'DRAFT' },
  })

  return NextResponse.json({ run: updated })
}

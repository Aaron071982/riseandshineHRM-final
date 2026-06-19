import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseArtemisWorkbook } from '@/lib/billing/artemisParser'
import { persistArtemisParse } from '@/lib/billing/persist'
import { suggestPayRatesForRbts } from '@/lib/billing/payRate'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const cycle = await prisma.billingCycle.findUnique({ where: { id: params.id } })
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }
  if (cycle.status === 'FINALIZED' || cycle.status === 'PAID') {
    return NextResponse.json({ error: 'Cycle is locked' }, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const fileName = file instanceof File ? file.name : 'upload.xlsx'
  const buffer = Buffer.from(await file.arrayBuffer())

  let parseResult
  try {
    parseResult = await parseArtemisWorkbook(buffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse file'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const result = await persistArtemisParse(params.id, parseResult, fileName)

  const periodWarning =
    parseResult.detectedDateRange.min && parseResult.detectedDateRange.max
      ? {
          detectedMin: parseResult.detectedDateRange.min.toISOString(),
          detectedMax: parseResult.detectedDateRange.max.toISOString(),
          periodStart: cycle.periodStart.toISOString(),
          periodEnd: cycle.periodEnd.toISOString(),
          mismatch:
            parseResult.detectedDateRange.min < cycle.periodStart ||
            parseResult.detectedDateRange.max > cycle.periodEnd,
        }
      : null

  const allRbtIds = (
    await prisma.rBTProfile.findMany({
      where: { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] } },
      select: { id: true },
    })
  ).map((r) => r.id)
  const suggestedRates = await suggestPayRatesForRbts(allRbtIds)

  const entries = await prisma.billingEntry.findMany({
    where: { billingCycleId: params.id },
    include: {
      rbtProfile: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  const entriesWithSuggestions = entries.map((e) => ({
    ...e,
    suggestedHourlyRate: e.rbtProfileId
      ? suggestedRates.get(e.rbtProfileId) ?? null
      : e.suggestedRbtProfileId
        ? suggestedRates.get(e.suggestedRbtProfileId) ?? null
        : null,
  }))

  return NextResponse.json({
    stats: result.stats,
    detectedDateRange: result.detectedDateRange,
    periodWarning,
    entries: entriesWithSuggestions,
    preview: `Found ${parseResult.stats.totalRows} billable session rows across ${parseResult.stats.payrollProviderCount + parseResult.stats.excludedProviderCount} providers. ${parseResult.stats.payrollSessionCount} RBT/BT sessions (Completed / Ready to Bill only)${parseResult.stats.skippedSessionCount > 0 ? `, ${parseResult.stats.skippedSessionCount} non-billable skipped` : ''}${parseResult.stats.cancelledSessionCount > 0 ? ` (${parseResult.stats.cancelledSessionCount} cancelled)` : ''}.`,
  })
}

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

  const hoursByStatus = parseResult.stats.hoursByStatus
  console.log('[billing/upload] Hours by status:', JSON.stringify(hoursByStatus, null, 2))

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
      sessions: { orderBy: { dos: 'asc' } },
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
    preview: `Parsed ${parseResult.stats.payrollSessionCount} RBT/BT sessions across ${parseResult.stats.payrollProviderCount} providers. Status hours: ${Object.entries(parseResult.stats.hoursByStatus).map(([k, h]) => `${k} ${h.toFixed(1)}h`).join(', ')}. Payable defaults: Completed + Ready to Bill.`,
    hoursByStatus: parseResult.stats.hoursByStatus,
  })
}

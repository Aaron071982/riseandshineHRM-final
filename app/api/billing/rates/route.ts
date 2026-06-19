import { NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { suggestPayRatesForRbts } from '@/lib/billing/payRate'

export async function GET() {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const rbts = await prisma.rBTProfile.findMany({
    where: { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      hourlyPayRate: true,
      artemisProviderName: true,
      payRateUpdatedAt: true,
      payRateUpdatedBy: true,
      status: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const ids = rbts.map((r) => r.id)
  const suggested = await suggestPayRatesForRbts(ids)

  const rates = rbts.map((r) => ({
    ...r,
    suggestedHourlyRate: r.hourlyPayRate == null ? suggested.get(r.id) ?? null : null,
    missingRate: r.hourlyPayRate == null,
  }))

  const missingCount = rates.filter((r) => r.missingRate).length

  return NextResponse.json({ rates, missingCount })
}

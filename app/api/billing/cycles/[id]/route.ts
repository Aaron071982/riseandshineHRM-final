import { NextRequest, NextResponse } from 'next/server'
import { requireBillingManagerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireBillingManagerSession()
  if (auth.response) return auth.response

  const cycle = await prisma.billingCycle.findUnique({
    where: { id: params.id },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      finalizedBy: { select: { name: true, email: true } },
      entries: {
        orderBy: [{ isExcluded: 'asc' }, { matchStatus: 'asc' }, { providerNameRaw: 'asc' }],
        include: {
          rbtProfile: {
            select: { id: true, firstName: true, lastName: true, hourlyPayRate: true, email: true },
          },
          payrollOnly: {
            select: { id: true, fullName: true, email: true, hourlyPayRate: true },
          },
          sessions: { orderBy: { dos: 'asc' } },
        },
      },
    },
  })

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  const candidates = await prisma.rBTProfile.findMany({
    where: { status: { in: ['HIRED', 'ONBOARDING_COMPLETED'] } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      artemisProviderName: true,
      hourlyPayRate: true,
      email: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const payrollOnlyPeople = await prisma.payrollOnlyPerson.findMany({
    orderBy: { fullName: 'asc' },
  })

  return NextResponse.json({ cycle, candidates, payrollOnlyPeople })
}

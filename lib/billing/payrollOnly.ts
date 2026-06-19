import { prisma } from '@/lib/prisma'

export type PayrollOnlyCandidate = {
  id: string
  fullName: string
  artemisProviderName: string
  email: string | null
  hourlyPayRate: number | null
}

export async function loadPayrollOnlyCandidates(): Promise<PayrollOnlyCandidate[]> {
  return prisma.payrollOnlyPerson.findMany({
    select: {
      id: true,
      fullName: true,
      artemisProviderName: true,
      email: true,
      hourlyPayRate: true,
    },
    orderBy: { fullName: 'asc' },
  })
}

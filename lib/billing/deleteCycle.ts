import { prisma } from '@/lib/prisma'

/** Remove a payroll cycle and all related entries, sessions, and hour confirmations. */
export async function deleteBillingCycle(cycleId: string): Promise<void> {
  const cycle = await prisma.billingCycle.findUnique({
    where: { id: cycleId },
    select: { id: true },
  })
  if (!cycle) throw new Error('Cycle not found')

  await prisma.billingCycle.delete({ where: { id: cycleId } })
}

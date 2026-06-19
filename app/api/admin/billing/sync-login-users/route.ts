import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { syncBillingProfileLoginUsers } from '@/lib/billing-portal-users'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Admin: create BILLING login users for Rafique/Afrin + all billing_profiles with emails. */
export async function POST() {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const synced = await syncBillingProfileLoginUsers()
  const billingUsers = await prisma.user.findMany({
    where: { role: 'BILLING' },
    select: { id: true, email: true, name: true, isActive: true },
    orderBy: { email: 'asc' },
  })

  return NextResponse.json({ synced, billingUsers })
}

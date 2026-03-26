import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { Suspense } from 'react'
import EmployeesList from '@/components/admin/EmployeesList'
import EmployeesPageHero from '@/components/admin/EmployeesPageHero'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export type EmployeeListType = 'RBT' | 'BCBA' | 'BILLING' | 'MARKETING' | 'CALL_CENTER' | 'DEV_TEAM'

interface SearchParams {
  type?: string
  search?: string
  status?: string
  view?: string
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const type = (searchParams.type || 'RBT') as EmployeeListType
  const search = searchParams.search || ''
  const statusFilter = searchParams.status || ''
  const viewMode = searchParams.view === 'board' ? 'board' : 'list'

  const validTypes: EmployeeListType[] = ['RBT', 'BCBA', 'BILLING', 'MARKETING', 'CALL_CENTER', 'DEV_TEAM']
  const currentType = validTypes.includes(type) ? type : 'RBT'

  let rbts: Prisma.RBTProfileGetPayload<{ include: { user: true } }>[] = []
  let bcbaProfiles: { id: string; fullName: string; email: string | null; phone: string | null; status: string | null; updatedAt: Date }[] = []
  let billingProfiles: { id: string; fullName: string; email: string | null; phone: string | null; status: string | null; updatedAt: Date }[] = []
  let marketingProfiles: { id: string; fullName: string; email: string | null; phone: string | null; status: string | null; updatedAt: Date }[] = []
  let callCenterProfiles: { id: string; fullName: string; email: string | null; phone: string | null; status: string | null; updatedAt: Date }[] = []
  let devTeams: { id: string; name: string; description: string | null; _count: { members: number }; updatedAt: Date }[] = []
  let loadError = false

  try {
    if (currentType === 'RBT') {
      const where: any = {}
      if (statusFilter && ['NEW', 'REACH_OUT', 'REACH_OUT_EMAIL_SENT', 'TO_INTERVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED', 'ONBOARDING_COMPLETED', 'STALLED', 'REJECTED'].includes(statusFilter)) {
        where.status = statusFilter
      }
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ]
      }
      rbts = await prisma.rBTProfile.findMany({
        where,
        include: { user: true },
        orderBy: { updatedAt: 'desc' },
      })
    } else if (currentType === 'BCBA') {
      const where: any = {}
      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ]
      }
      bcbaProfiles = await prisma.bCBAProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, fullName: true, email: true, phone: true, status: true, updatedAt: true },
      })
    } else if (currentType === 'BILLING') {
      const where: any = {}
      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ]
      }
      billingProfiles = await prisma.billingProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, fullName: true, email: true, phone: true, status: true, updatedAt: true },
      })
    } else if (currentType === 'MARKETING') {
      const where: any = {}
      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ]
      }
      marketingProfiles = await prisma.marketingProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, fullName: true, email: true, phone: true, status: true, updatedAt: true },
      })
    } else if (currentType === 'CALL_CENTER') {
      const where: any = {}
      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ]
      }
      callCenterProfiles = await prisma.callCenterProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, fullName: true, email: true, phone: true, status: true, updatedAt: true },
      })
    } else if (currentType === 'DEV_TEAM') {
      const where: any = {}
      if (search) {
        where.name = { contains: search, mode: 'insensitive' }
      }
      devTeams = await prisma.devTeam.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { members: true } } },
      })
    }
  } catch (error) {
    console.error('Admin employees: failed to load', error)
    loadError = true
  }

  return (
    <div className="min-h-[60vh] space-y-6 bg-gray-50 dark:bg-[var(--bg-primary)]">
      <Suspense fallback={<div className="rounded-2xl bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-400 p-8 animate-pulse" />}>
        <EmployeesPageHero currentType={currentType} />
      </Suspense>

      <Suspense fallback={<div className="rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] p-8 text-center text-gray-500 dark:text-[var(--text-tertiary)]">Loading…</div>}>
        <EmployeesList
          currentType={currentType}
          viewMode={viewMode}
          initialRbts={currentType === 'RBT' ? rbts : []}
          bcbaProfiles={currentType === 'BCBA' ? bcbaProfiles : []}
          billingProfiles={currentType === 'BILLING' ? billingProfiles : []}
          marketingProfiles={currentType === 'MARKETING' ? marketingProfiles : []}
          callCenterProfiles={currentType === 'CALL_CENTER' ? callCenterProfiles : []}
          devTeams={currentType === 'DEV_TEAM' ? devTeams : []}
          loadError={loadError}
        />
      </Suspense>
    </div>
  )
}

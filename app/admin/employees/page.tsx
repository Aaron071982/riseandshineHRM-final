import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import Link from 'next/link'
import { Suspense } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import EmployeesList from '@/components/admin/EmployeesList'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export type EmployeeListType = 'RBT' | 'BCBA' | 'BILLING' | 'MARKETING' | 'CALL_CENTER' | 'DEV_TEAM'

interface SearchParams {
  type?: string
  search?: string
  status?: string
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const type = (searchParams.type || 'RBT') as EmployeeListType
  const search = searchParams.search || ''
  const statusFilter = searchParams.status || ''

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
      if (statusFilter && ['NEW', 'REACH_OUT', 'REACH_OUT_EMAIL_SENT', 'TO_INTERVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED', 'REJECTED'].includes(statusFilter)) {
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Employees and Candidates</h1>
            <p className="text-blue-50 text-lg">Manage your hiring pipeline and all employees</p>
          </div>
          <Link href="/admin/employees/new">
            <Button className="rounded-xl px-6 py-6 text-base font-semibold bg-white/90 text-blue-700 hover:bg-white border-0 shadow-md">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee / Candidate
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<div className="rounded-lg border border-gray-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-elevated)] p-8 text-center text-gray-500 dark:text-[var(--text-tertiary)]">Loading…</div>}>
        <EmployeesList
          currentType={currentType}
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

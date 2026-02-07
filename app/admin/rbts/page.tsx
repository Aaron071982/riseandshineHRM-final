import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import RBTList from '@/components/admin/RBTList'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SearchParams {
  search?: string
  status?: string
}

export default async function RBTPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const search = searchParams.search || ''
  const statusFilter = searchParams.status || ''

  const where: any = {}

  if (statusFilter) {
    // Validate that statusFilter is a valid RBTStatus enum value
    const validStatuses = ['NEW', 'REACH_OUT', 'TO_INTERVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED', 'REJECTED']
    if (validStatuses.includes(statusFilter)) {
      where.status = statusFilter
    }
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phoneNumber: { contains: search, mode: 'insensitive' } },
    ]
  }

  type RBTWithUser = Prisma.RBTProfileGetPayload<{ include: { user: true } }>
  let rbts: RBTWithUser[] = []
  let loadError = false
  try {
    rbts = await prisma.rBTProfile.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })
  } catch (error) {
    console.error('Admin rbts: failed to load', error)
    // Fallback: load via raw query so RBTs show even if Prisma schema/columns are out of sync (e.g. missing experienceYears)
    try {
      const raw = await prisma.$queryRaw<
        Array<{
          id: string
          firstName: string
          lastName: string
          phoneNumber: string
          email: string | null
          locationCity: string | null
          locationState: string | null
          zipCode: string | null
          status: string
          source: string | null
          updatedAt: Date
          userId: string
          user_role: string
          user_isActive: boolean
        }>
      >`
        SELECT
          r.id, r."firstName", r."lastName", r."phoneNumber", r.email,
          r."locationCity", r."locationState", r."zipCode", r.status, r.source, r."updatedAt", r."userId",
          u.role as user_role, u."isActive" as user_isActive
        FROM rbt_profiles r
        JOIN users u ON u.id = r."userId"
        ORDER BY r."updatedAt" DESC
      `
      rbts = raw.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        phoneNumber: row.phoneNumber,
        email: row.email,
        locationCity: row.locationCity,
        locationState: row.locationState,
        zipCode: row.zipCode,
        status: row.status,
        source: row.source,
        updatedAt: row.updatedAt,
        userId: row.userId,
        user: {
          id: row.userId,
          role: row.user_role as any,
          isActive: row.user_isActive,
          name: null,
          phoneNumber: null,
          email: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Omit other RBTProfile fields not needed for list
      })) as RBTWithUser[]
    } catch (rawError) {
      console.error('Admin rbts: raw fallback also failed', rawError)
      loadError = true
    }
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-[var(--status-warning-bg)] dark:border-[var(--status-warning-border)] p-4 text-amber-900 dark:text-[var(--status-warning-text)]">
          <p className="font-semibold">Data could not be loaded</p>
          <p className="text-sm mt-1">Your data is still in the database. The app could not read it—often due to a missing schema update. In Supabase: open SQL Editor and run the migration (see prisma/supabase-migrations.sql). Run at least sections 4 and 5. Then refresh this page. To confirm the app is using this database, open <code className="bg-black/10 dark:bg-white/10 px-1 rounded">/api/debug/db-counts</code> in your browser.</p>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">RBTs & Candidates</h1>
          <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">Manage your RBT hiring pipeline and active RBTs</p>
        </div>
        <Link href="/admin/rbts/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add New Candidate
          </Button>
        </Link>
      </div>

      <RBTList initialRbts={rbts} loadError={loadError} />
    </div>
  )
}


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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-400 p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 bubble-animation" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12 bubble-animation-delayed" />
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">RBTs & Candidates</h1>
            <p className="text-blue-50 text-lg">Manage your RBT hiring pipeline and active RBTs</p>
          </div>
          <Link href="/admin/rbts/new">
            <Button className="rounded-xl px-6 py-6 text-base font-semibold bg-white/90 text-blue-700 hover:bg-white border-0 shadow-md">
              <Plus className="w-4 h-4 mr-2" />
              Add New Candidate
            </Button>
          </Link>
        </div>
      </div>

      <RBTList initialRbts={rbts} loadError={loadError} />
    </div>
  )
}


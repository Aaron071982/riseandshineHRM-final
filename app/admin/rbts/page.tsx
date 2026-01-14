import { prisma } from '@/lib/prisma'
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

  const rbts = await prisma.rBTProfile.findMany({
    where,
    include: {
      user: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">RBTs & Candidates</h1>
          <p className="text-gray-600 mt-1">Manage your RBT hiring pipeline and active RBTs</p>
        </div>
        <Link href="/admin/rbts/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add New Candidate
          </Button>
        </Link>
      </div>

      <RBTList initialRbts={rbts} />
    </div>
  )
}


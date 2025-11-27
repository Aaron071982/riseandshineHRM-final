'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Search, UserPlus, TrendingUp, Users as UsersIcon } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RBTProfile {
  id: string
  firstName: string
  lastName: string
  phoneNumber: string
  email: string | null
  locationCity: string | null
  locationState: string | null
  zipCode: string | null
  status: string
  updatedAt: Date
  user: {
    role: string
    isActive: boolean
  }
}

interface RBTListProps {
  initialRbts: RBTProfile[]
}

const statusColors: Record<string, { bg: string; text: string }> = {
  NEW: { bg: 'bg-gray-100', text: 'text-gray-700' },
  REACH_OUT: { bg: 'bg-blue-50', text: 'text-blue-700' },
  TO_INTERVIEW: { bg: 'bg-amber-50', text: 'text-amber-700' },
  INTERVIEW_SCHEDULED: { bg: 'bg-purple-50', text: 'text-purple-700' },
  INTERVIEW_COMPLETED: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  HIRED: { bg: 'bg-green-50', text: 'text-green-700' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700' },
}

export default function RBTList({ initialRbts }: RBTListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [isPending, startTransition] = useTransition()

  const handleSearch = (value: string) => {
    setSearch(value)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('search', value)
      } else {
        params.delete('search')
      }
      router.push(`/admin/rbts?${params.toString()}`)
    })
  }

  const handleStatusChange = (value: string) => {
    setStatus(value)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('status', value)
      } else {
        params.delete('status')
      }
      router.push(`/admin/rbts?${params.toString()}`)
    })
  }

  const statusCounts = initialRbts.reduce((acc, rbt) => {
    acc[rbt.status] = (acc[rbt.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filteredRbts = status
    ? initialRbts.filter((rbt) => rbt.status === status)
    : initialRbts

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Candidates</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{initialRbts.length}</p>
              </div>
              <UsersIcon className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Hired RBTs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{statusCounts['HIRED'] || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">New</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{statusCounts['NEW'] || 0}</p>
              </div>
              <UserPlus className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Pipeline</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {initialRbts.filter(r => r.status !== 'HIRED' && r.status !== 'REJECTED').length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={status || "all"} onValueChange={(value) => handleStatusChange(value === "all" ? "" : value)}>
              <SelectTrigger className="w-full md:w-[220px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="REACH_OUT">Reach Out</SelectItem>
                <SelectItem value="TO_INTERVIEW">To Interview</SelectItem>
                <SelectItem value="INTERVIEW_SCHEDULED">Interview Scheduled</SelectItem>
                <SelectItem value="INTERVIEW_COMPLETED">Interview Completed</SelectItem>
                <SelectItem value="HIRED">Hired</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Candidates Grid */}
      {filteredRbts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-lg font-medium text-gray-700 mb-2">No candidates found</p>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRbts.map((rbt) => {
            const statusConfig = statusColors[rbt.status] || statusColors.NEW
            return (
              <Card
                key={rbt.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {rbt.firstName} {rbt.lastName}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className={`${statusConfig.bg} ${statusConfig.text} border-0`}
                        >
                          {rbt.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="text-sm text-gray-600">
                      {rbt.phoneNumber}
                    </div>
                    {rbt.email && (
                      <div className="text-sm text-gray-600 truncate">
                        {rbt.email}
                      </div>
                    )}
                    {(rbt.locationCity || rbt.zipCode) && (
                      <div className="text-sm text-gray-600">
                        {rbt.locationCity && rbt.locationState
                          ? `${rbt.locationCity}, ${rbt.locationState}`
                          : rbt.zipCode || '—'}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-xs text-gray-500">
                      Updated {formatDate(rbt.updatedAt)}
                    </span>
                    <Link href={`/admin/rbts/${rbt.id}`}>
                      <Button size="sm" variant="outline">
                        View →
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

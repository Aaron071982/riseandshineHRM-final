// DEV ONLY — NOT FOR PRODUCTION — NO DB
// List component for intern candidates

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Search, UserPlus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { InternCandidate } from '@/lib/intern-storage'

interface InternCandidateListProps {
  initialCandidates: InternCandidate[]
}

const statusColors: Record<string, { bg: string; text: string }> = {
  'Applied': { bg: 'bg-gray-100', text: 'text-gray-700' },
  'Interview Scheduled': { bg: 'bg-purple-50', text: 'text-purple-700' },
  'Interview Completed': { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  'Hired': { bg: 'bg-green-50', text: 'text-green-700' },
  'Rejected': { bg: 'bg-red-50', text: 'text-red-700' },
}

export default function InternCandidateList({ initialCandidates }: InternCandidateListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filteredCandidates = initialCandidates.filter(candidate => {
    const matchesSearch = !search || 
      candidate.name.toLowerCase().includes(search.toLowerCase()) ||
      candidate.email.toLowerCase().includes(search.toLowerCase()) ||
      (candidate.phone && candidate.phone.includes(search))
    
    const matchesStatus = !statusFilter || candidate.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const statusCounts = initialCandidates.reduce((acc, candidate) => {
    acc[candidate.status] = (acc[candidate.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {Object.entries(statusColors).map(([status, colors]) => (
          <Card key={status}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{status}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statusCounts[status] || 0}
                  </p>
                </div>
                <div className={`${colors.bg} ${colors.text} rounded-full p-3`}>
                  <UserPlus className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-full md:w-[220px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Applied">Applied</SelectItem>
                <SelectItem value="Interview Scheduled">Interview Scheduled</SelectItem>
                <SelectItem value="Interview Completed">Interview Completed</SelectItem>
                <SelectItem value="Hired">Hired</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Candidates Grid */}
      {filteredCandidates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No candidates found</h3>
            <p className="text-gray-600">
              {search || statusFilter
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by creating your first intern candidate'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCandidates.map((candidate) => {
            const statusColor = statusColors[candidate.status] || statusColors['Applied']
            return (
              <Link key={candidate.id} href={`/admin/interns/candidates/${candidate.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {candidate.name}
                          </h3>
                          <Badge className={`${statusColor.bg} ${statusColor.text} border-0`}>
                            {candidate.status}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><span className="font-medium">Email:</span> {candidate.email}</p>
                          {candidate.phone && (
                            <p><span className="font-medium">Phone:</span> {candidate.phone}</p>
                          )}
                          <p><span className="font-medium">Role:</span> {candidate.role}</p>
                          <p><span className="font-medium">Created:</span> {formatDate(new Date(candidate.createdAt))}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}



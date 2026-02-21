'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Search, UserPlus, TrendingUp, Users as UsersIcon, Code2, Headphones, Megaphone, Calculator, Users } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EmployeeListType } from '@/app/admin/employees/page'

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
  source: string | null
  updatedAt: Date
  user: { role: string; isActive: boolean }
}

interface GenericProfile {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  status: string | null
  updatedAt: Date
}

interface DevTeamWithCount {
  id: string
  name: string
  description: string | null
  _count: { members: number }
  updatedAt: Date
}

interface EmployeesListProps {
  currentType: EmployeeListType
  initialRbts: RBTProfile[]
  bcbaProfiles: GenericProfile[]
  billingProfiles: GenericProfile[]
  marketingProfiles: GenericProfile[]
  callCenterProfiles: GenericProfile[]
  devTeams: DevTeamWithCount[]
  loadError?: boolean
}

const statusColors: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  NEW: { bg: 'bg-gray-100', text: 'text-gray-700', darkBg: 'dark:bg-[var(--bg-elevated)]', darkText: 'dark:text-[var(--text-primary)]' },
  REACH_OUT: { bg: 'bg-blue-50', text: 'text-blue-700', darkBg: 'dark:bg-[var(--status-interview-bg)]', darkText: 'dark:text-[var(--status-interview-text)]' },
  REACH_OUT_EMAIL_SENT: { bg: 'bg-blue-100', text: 'text-blue-800', darkBg: 'dark:bg-[var(--status-interview-bg)]', darkText: 'dark:text-[var(--status-interview-text)]' },
  TO_INTERVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', darkBg: 'dark:bg-[var(--status-warning-bg)]', darkText: 'dark:text-[var(--status-warning-text)]' },
  INTERVIEW_SCHEDULED: { bg: 'bg-purple-50', text: 'text-purple-700', darkBg: 'dark:bg-[var(--status-onboarding-bg)]', darkText: 'dark:text-[var(--status-onboarding-text)]' },
  INTERVIEW_COMPLETED: { bg: 'bg-indigo-50', text: 'text-indigo-700', darkBg: 'dark:bg-[var(--status-scheduled-bg)]', darkText: 'dark:text-[var(--status-scheduled-text)]' },
  HIRED: { bg: 'bg-green-50', text: 'text-green-700', darkBg: 'dark:bg-[var(--status-hired-bg)]', darkText: 'dark:text-[var(--status-hired-text)]' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', darkBg: 'dark:bg-[var(--status-rejected-bg)]', darkText: 'dark:text-[var(--status-rejected-text)]' },
}

const TYPE_OPTIONS: { value: EmployeeListType; label: string }[] = [
  { value: 'RBT', label: 'RBT' },
  { value: 'BCBA', label: 'BCBA' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'CALL_CENTER', label: 'Call Center' },
  { value: 'DEV_TEAM', label: 'Dev Team' },
]

export default function EmployeesList({
  currentType,
  initialRbts,
  bcbaProfiles,
  billingProfiles,
  marketingProfiles,
  callCenterProfiles,
  devTeams,
  loadError,
}: EmployeesListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [type, setType] = useState(currentType)
  const [isPending, startTransition] = useTransition()

  const handleTypeChange = (value: EmployeeListType) => {
    setType(value)
    startTransition(() => {
      const params = new URLSearchParams()
      params.set('type', value)
      if (search) params.set('search', search)
      if (value === 'RBT' && status) params.set('status', status)
      router.push(`/admin/employees?${params.toString()}`)
    })
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('type', currentType)
      if (value) params.set('search', value)
      else params.delete('search')
      router.push(`/admin/employees?${params.toString()}`)
    })
  }

  const handleStatusChange = (value: string) => {
    setStatus(value)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('type', currentType)
      if (value) params.set('status', value)
      else params.delete('status')
      router.push(`/admin/employees?${params.toString()}`)
    })
  }

  const statusCounts = initialRbts.reduce((acc, rbt) => {
    acc[rbt.status] = (acc[rbt.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filteredRbts = status ? initialRbts.filter((r) => r.status === status) : initialRbts

  const totalCount =
    currentType === 'RBT'
      ? (currentType === 'RBT' ? filteredRbts.length : initialRbts.length)
      : currentType === 'BCBA'
        ? bcbaProfiles.length
        : currentType === 'BILLING'
          ? billingProfiles.length
          : currentType === 'MARKETING'
            ? marketingProfiles.length
            : currentType === 'CALL_CENTER'
              ? callCenterProfiles.length
              : devTeams.length

  const showStatusFilter = currentType === 'RBT'
  const listCount = currentType === 'RBT' ? filteredRbts.length : totalCount

  return (
    <div className="space-y-6">
      {/* Stats - type-aware */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">
                  {currentType === 'RBT' ? 'Total Candidates' : currentType === 'DEV_TEAM' ? 'Total Teams' : `Total ${TYPE_OPTIONS.find((o) => o.value === currentType)?.label || currentType}`}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] mt-1">{totalCount}</p>
              </div>
              <UsersIcon className="h-8 w-8 text-gray-400 dark:text-[var(--text-tertiary)]" />
            </div>
          </CardContent>
        </Card>
        {currentType === 'RBT' && (
          <>
            <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">Hired RBTs</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-[var(--status-hired-text)] mt-1">{statusCounts['HIRED'] || 0}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">New</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] mt-1">{statusCounts['NEW'] || 0}</p>
                  </div>
                  <UserPlus className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">In Pipeline</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-[var(--status-onboarding-text)] mt-1">
                      {initialRbts.filter((r) => r.status !== 'HIRED' && r.status !== 'REJECTED').length}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
        {currentType !== 'RBT' && <div className="md:col-span-3" aria-hidden />}
      </div>

      {/* Type filter + Search + Status (RBT only) */}
      <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={currentType} onValueChange={(v) => handleTypeChange(v as EmployeeListType)}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[var(--text-disabled)] w-5 h-5" />
              <Input
                placeholder={
                  currentType === 'DEV_TEAM' ? 'Search by team name...' : 'Search by name, phone, or email...'
                }
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 dark:bg-[var(--bg-input)] dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)]"
              />
            </div>
            {showStatusFilter && (
              <Select value={status || 'all'} onValueChange={(v) => handleStatusChange(v === 'all' ? '' : v)}>
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loadError ? (
        <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
          <CardContent className="p-12 text-center">
            <p className="text-lg font-medium text-amber-700 dark:text-[var(--status-warning-text)] mb-2">Data failed to load</p>
            <p className="text-gray-500 dark:text-[var(--text-tertiary)]">Refresh the page or check the console.</p>
          </CardContent>
        </Card>
      ) : currentType === 'RBT' ? (
        filteredRbts.length === 0 ? (
          <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
            <CardContent className="p-12 text-center">
              <p className="text-lg font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-2">No candidates found</p>
              <p className="text-gray-500 dark:text-[var(--text-tertiary)]">Try adjusting your search or filter</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRbts.map((rbt) => {
              const statusConfig = statusColors[rbt.status] || statusColors.NEW
              return (
                <Card
                  key={rbt.id}
                  className="hover:shadow-md dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)] dark:hover:bg-[var(--bg-elevated-hover)] transition-all"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                          {rbt.firstName} {rbt.lastName}
                        </h3>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-[var(--status-interview-bg)] dark:text-[var(--status-interview-text)] border-0">
                            RBT
                          </Badge>
                          <Badge variant="outline" className={`${statusConfig.bg} ${statusConfig.text} ${statusConfig.darkBg} ${statusConfig.darkText} border-0`}>
                            {rbt.status.replace(/_/g, ' ')}
                          </Badge>
                          {rbt.source === 'PUBLIC_APPLICATION' && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-[var(--orange-subtle)] dark:text-[var(--orange-primary)] dark:border-[var(--orange-border)]">
                              Applied Online
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">{rbt.phoneNumber}</div>
                      {rbt.email && <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] truncate">{rbt.email}</div>}
                      {(rbt.locationCity || rbt.zipCode) && (
                        <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                          {rbt.locationCity && rbt.locationState ? `${rbt.locationCity}, ${rbt.locationState}` : rbt.zipCode || '—'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t dark:border-[var(--border-subtle)]">
                      <span className="text-xs text-gray-500 dark:text-[var(--text-disabled)]">Updated {formatDate(rbt.updatedAt)}</span>
                      <Link href={`/admin/rbts/${rbt.id}`}>
                        <Button size="sm" variant="outline" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:border-[var(--orange-primary)] dark:hover:text-[var(--orange-primary)]">
                          View →
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      ) : currentType === 'DEV_TEAM' ? (
        devTeams.length === 0 ? (
          <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
            <CardContent className="p-12 text-center">
              <p className="text-lg font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-2">No teams found</p>
              <p className="text-gray-500 dark:text-[var(--text-tertiary)]">Add a dev team from the Add menu.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devTeams.map((team) => (
              <Card
                key={team.id}
                className="hover:shadow-md dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)] dark:hover:bg-[var(--bg-elevated-hover)] transition-all"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">{team.name}</h3>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="bg-violet-50 text-violet-700 dark:bg-[var(--status-onboarding-bg)] dark:text-[var(--status-onboarding-text)] border-0">
                          Dev Team
                        </Badge>
                        <Badge variant="secondary">{team._count.members} member{team._count.members !== 1 ? 's' : ''}</Badge>
                      </div>
                    </div>
                  </div>
                  {team.description && (
                    <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mb-4 line-clamp-2">{team.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t dark:border-[var(--border-subtle)]">
                    <span className="text-xs text-gray-500 dark:text-[var(--text-disabled)]">Updated {formatDate(team.updatedAt)}</span>
                    <Link href={`/admin/employees/teams/${team.id}`}>
                      <Button size="sm" variant="outline" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:border-[var(--orange-primary)] dark:hover:text-[var(--orange-primary)]">
                        View team →
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        (() => {
          const profiles =
            currentType === 'BCBA'
              ? bcbaProfiles
              : currentType === 'BILLING'
                ? billingProfiles
                : currentType === 'MARKETING'
                  ? marketingProfiles
                  : callCenterProfiles
          const typeLabel = TYPE_OPTIONS.find((o) => o.value === currentType)?.label || currentType
          const viewBase =
            currentType === 'BCBA'
              ? '/admin/employees/bcba'
              : currentType === 'BILLING'
                ? '/admin/employees/billing'
                : currentType === 'MARKETING'
                  ? '/admin/employees/marketing'
                  : '/admin/employees/call-center'

          if (profiles.length === 0) {
            return (
              <Card className="dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)]">
                <CardContent className="p-12 text-center">
                  <p className="text-lg font-medium text-gray-700 dark:text-[var(--text-secondary)] mb-2">No {typeLabel} profiles found</p>
                  <p className="text-gray-500 dark:text-[var(--text-tertiary)]">Add one from the Add menu.</p>
                </CardContent>
              </Card>
            )
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map((p) => (
                <Card
                  key={p.id}
                  className="hover:shadow-md dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)] dark:hover:bg-[var(--bg-elevated-hover)] transition-all"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">{p.fullName}</h3>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-[var(--bg-elevated)] dark:text-[var(--text-secondary)] border-0">
                            {typeLabel}
                          </Badge>
                          {p.status && (
                            <Badge variant="secondary">{p.status}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      {p.phone && <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">{p.phone}</div>}
                      {p.email && <div className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] truncate">{p.email}</div>}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t dark:border-[var(--border-subtle)]">
                      <span className="text-xs text-gray-500 dark:text-[var(--text-disabled)]">Updated {formatDate(p.updatedAt)}</span>
                      <Link href={`${viewBase}/${p.id}`}>
                        <Button size="sm" variant="outline" className="dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:border-[var(--orange-primary)] dark:hover:text-[var(--orange-primary)]">
                          View →
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        })()
      )}
    </div>
  )
}

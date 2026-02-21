'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

type HiredRBT = { id: string; firstName: string; lastName: string }
type RangeOption = { value: string; label: string }

export function AttendanceFilters({
  rangeParam,
  rbtProfileIdFilter,
  hiredRBTs,
  rangeOptions,
}: {
  rangeParam: string
  rbtProfileIdFilter: string | null
  hiredRBTs: HiredRBT[]
  rangeOptions: readonly RangeOption[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setFilter = useCallback(
    (key: 'range' | 'rbtProfileId', value: string) => {
      const next = new URLSearchParams(searchParams.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      router.push(`/admin/attendance?${next.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-gray-200 dark:border-[var(--border-subtle)] p-4 bg-white dark:bg-[var(--bg-elevated)]">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">Date range</Label>
        <Select value={rangeParam} onValueChange={(v) => setFilter('range', v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rangeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-[var(--text-secondary)]">RBT</Label>
        <Select value={rbtProfileIdFilter || 'all'} onValueChange={(v) => setFilter('rbtProfileId', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All RBTs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All RBTs</SelectItem>
            {hiredRBTs.map((rbt) => (
              <SelectItem key={rbt.id} value={rbt.id}>
                {rbt.lastName}, {rbt.firstName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

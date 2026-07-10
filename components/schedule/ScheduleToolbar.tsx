'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ViewMode, RowDimension } from '@/lib/schedule/types'
import { Plus, Settings2, Download } from 'lucide-react'

interface Props {
  stats: {
    slotCount: number
    totalHours: string
    therapistCount: number
    clientCount: number
    conflictCount: number
  }
  view: ViewMode
  onViewChange: (v: ViewMode) => void
  rowDim: RowDimension
  onRowDimChange: (d: RowDimension) => void
  search: string
  onSearchChange: (s: string) => void
  showCancelled: boolean
  onShowCancelledChange: (v: boolean) => void
  showAllRows: boolean
  onShowAllRowsChange: (v: boolean) => void
  onAddSession: () => void
  onManage: () => void
  onExport: () => void
}

export default function ScheduleToolbar({
  stats,
  view,
  onViewChange,
  rowDim,
  onRowDimChange,
  search,
  onSearchChange,
  showCancelled,
  onShowCancelledChange,
  showAllRows,
  onShowAllRowsChange,
  onAddSession,
  onManage,
  onExport,
}: Props) {
  const tabs: { id: ViewMode; label: string }[] = [
    { id: 'roster', label: 'Roster' },
    { id: 'table', label: 'Table' },
    { id: 'hours', label: 'Client hours' },
  ]

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-[#E4E8E9] dark:border-gray-700 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="tabular-nums">
          <strong className="text-[#0E4D52]">{stats.slotCount}</strong> sessions
        </span>
        <span className="tabular-nums text-[#E7A13A] font-semibold">{stats.totalHours} hrs</span>
        <span className="text-gray-500">{stats.therapistCount} therapists · {stats.clientCount} clients</span>
        {stats.conflictCount > 0 && (
          <span className="text-amber-600 font-medium">⚠ {stats.conflictCount} conflicts</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onViewChange(t.id)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                view === t.id
                  ? 'bg-[#0E4D52] text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === 'roster' && (
            <div className="flex rounded-md border border-[#E4E8E9] overflow-hidden text-xs">
              <button
                type="button"
                className={cn(
                  'px-2.5 py-1.5',
                  rowDim === 'therapist' && 'bg-[#0E4D52] text-white'
                )}
                onClick={() => onRowDimChange('therapist')}
              >
                Therapist rows
              </button>
              <button
                type="button"
                className={cn(
                  'px-2.5 py-1.5',
                  rowDim === 'client' && 'bg-[#0E4D52] text-white'
                )}
                onClick={() => onRowDimChange('client')}
              >
                Client rows
              </button>
            </div>
          )}
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 w-36 text-sm"
          />
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllRows}
              onChange={(e) => onShowAllRowsChange(e.target.checked)}
            />
            Show all
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => onShowCancelledChange(e.target.checked)}
            />
            Cancelled
          </label>
          <Button size="sm" className="bg-[#0E4D52] hover:bg-[#0A3A3E]" onClick={onAddSession}>
            <Plus className="w-4 h-4 mr-1" />
            Add session
          </Button>
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button size="sm" variant="outline" onClick={onManage}>
            <Settings2 className="w-4 h-4 mr-1" />
            Manage
          </Button>
        </div>
      </div>
    </div>
  )
}

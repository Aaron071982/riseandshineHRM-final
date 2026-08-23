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
  onExportAll?: () => void
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
  onExportAll,
}: Props) {
  const tabs: { id: ViewMode; label: string }[] = [
    { id: 'roster', label: 'Roster' },
    { id: 'table', label: 'Table' },
    { id: 'hours', label: 'Client hours' },
  ]

  return (
    <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="tabular-nums text-ink">
          <strong className="font-semibold">{stats.slotCount}</strong> sessions
        </span>
        <span className="tabular-nums font-semibold text-brand">{stats.totalHours} hrs</span>
        <span className="text-quiet">
          {stats.therapistCount} therapists · {stats.clientCount} clients
        </span>
        {stats.conflictCount > 0 && (
          <span className="font-medium text-[var(--amber)]">
            {stats.conflictCount} conflicts
          </span>
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
                'h-8 px-3 rounded-lg text-sm font-medium transition-colors',
                view === t.id
                  ? 'bg-brand text-white'
                  : 'text-quiet hover:bg-line-2 hover:text-ink'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === 'roster' && (
            <div className="flex rounded-lg border border-line overflow-hidden text-xs">
              <button
                type="button"
                className={cn(
                  'px-2.5 py-1.5 transition-colors',
                  rowDim === 'therapist'
                    ? 'bg-brand text-white'
                    : 'text-quiet hover:bg-line-2'
                )}
                onClick={() => onRowDimChange('therapist')}
              >
                Therapist rows
              </button>
              <button
                type="button"
                className={cn(
                  'px-2.5 py-1.5 transition-colors',
                  rowDim === 'client'
                    ? 'bg-brand text-white'
                    : 'text-quiet hover:bg-line-2'
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
            className="h-8 w-36 text-sm border-line bg-surface"
          />
          <label className="flex items-center gap-1.5 text-xs text-quiet cursor-pointer">
            <input
              type="checkbox"
              checked={showAllRows}
              onChange={(e) => onShowAllRowsChange(e.target.checked)}
              className="rounded border-line"
            />
            Show inactive
          </label>
          <label className="flex items-center gap-1.5 text-xs text-quiet cursor-pointer">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => onShowCancelledChange(e.target.checked)}
              className="rounded border-line"
            />
            Cancelled
          </label>
          <Button
            size="sm"
            className="h-8 bg-brand hover:bg-brand-2 text-white"
            onClick={onAddSession}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add session
          </Button>
          <Button size="sm" variant="outline" className="h-8 border-line" onClick={onExport}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          {onExportAll && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-quiet"
              onClick={onExportAll}
              title="Export all boroughs"
            >
              Export all
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 border-line" onClick={onManage}>
            <Settings2 className="w-4 h-4 mr-1" />
            Manage
          </Button>
        </div>
      </div>
    </div>
  )
}

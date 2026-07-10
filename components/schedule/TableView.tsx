'use client'

import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import type { ScheduleSlot, ScheduleTherapist, ScheduleClient } from '@/lib/schedule/types'
import { hoursOf, fmtH, minToInput, inputToMin, DAY_LABEL, type Day } from '@/lib/schedule/utils'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { bulkUpdateSlots, bulkDeleteSlots } from '@/lib/schedule/actions'

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-800',
  TENTATIVE: 'bg-blue-100 text-blue-800',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

export default function TableView({
  therapists,
  clients,
  slots,
  conflicts,
  onEdit,
  onRefresh,
  onAdd,
}: {
  therapists: ScheduleTherapist[]
  clients: ScheduleClient[]
  slots: ScheduleSlot[]
  conflicts: Map<string, string[]>
  onEdit: (slot: ScheduleSlot) => void
  onRefresh: () => void
  onAdd: () => void
}) {
  const { showToast } = useToast()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const tMap = useMemo(() => new Map(therapists.map((t) => [t.id, t])), [therapists])
  const cMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])

  const columns = useMemo<ColumnDef<ScheduleSlot>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        size: 32,
      },
      {
        accessorKey: 'therapistId',
        header: 'Therapist',
        cell: ({ row, getValue }) => tMap.get(getValue() as string)?.name ?? '—',
      },
      {
        accessorKey: 'clientId',
        header: 'Client',
        cell: ({ row, getValue }) => {
          const c = cMap.get(getValue() as string)
          return c ? `${c.name}${c.code ? ` (${c.code})` : ''}` : '—'
        },
      },
      {
        accessorKey: 'day',
        header: 'Day',
        cell: ({ getValue }) => DAY_LABEL[getValue() as Day] ?? getValue(),
      },
      {
        accessorKey: 'startMin',
        header: 'Start',
        cell: ({ getValue }) => minToInput(getValue() as number),
      },
      {
        accessorKey: 'endMin',
        header: 'End',
        cell: ({ getValue }) => minToInput(getValue() as number),
      },
      {
        id: 'hours',
        header: 'Hours',
        cell: ({ row }) => fmtH(hoursOf(row.original)),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const s = getValue() as string
          return <Badge className={STATUS_COLORS[s] ?? ''}>{s}</Badge>
        },
      },
      {
        accessorKey: 'note',
        header: 'Note',
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>
            Edit
          </Button>
        ),
      },
    ],
    [tMap, cMap, onEdit]
  )

  const table = useReactTable({
    data: slots,
    columns,
    state: { sorting, globalFilter, rowSelection: Object.fromEntries([...selected].map((id) => [id, true])) },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater(Object.fromEntries([...selected].map((id) => [id, true])))
          : updater
      setSelected(new Set(Object.keys(next).filter((k) => next[k])))
    },
  })

  const filteredHours = fmtH(
    table.getFilteredRowModel().rows.reduce((a, r) => a + hoursOf(r.original), 0)
  )

  const bulkStatus = async (status: string) => {
    const ids = [...selected]
    if (!ids.length) return
    try {
      await bulkUpdateSlots(ids, { status })
      showToast(`Updated ${ids.length} sessions`, 'success')
      setSelected(new Set())
      onRefresh()
    } catch {
      showToast('Bulk update failed', 'error')
    }
  }

  const bulkDelete = async () => {
    const ids = [...selected]
    if (!ids.length || !confirm(`Delete ${ids.length} sessions?`)) return
    try {
      await bulkDeleteSlots(ids)
      showToast(`Deleted ${ids.length} sessions`, 'success')
      setSelected(new Set())
      onRefresh()
    } catch {
      showToast('Bulk delete failed', 'error')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-[#E4E8E9] overflow-hidden">
      <div className="p-3 border-b flex flex-wrap gap-2 items-center justify-between">
        <input
          placeholder="Filter table…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm h-8"
        />
        {selected.size > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkStatus('CONFIRMED')}>
              Confirm ({selected.size})
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkStatus('NEEDS_REVIEW')}>
              Flag review
            </Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete}>
              Delete
            </Button>
          </div>
        )}
        <Button size="sm" onClick={onAdd} className="bg-[#0E4D52]">
          Add row
        </Button>
      </div>
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6F6] sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="text-left p-2 font-medium cursor-pointer whitespace-nowrap"
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const hasConflict = conflicts.has(row.original.id)
              return (
                <tr
                  key={row.id}
                  className={`border-t border-[#E4E8E9] hover:bg-gray-50 ${hasConflict ? 'bg-amber-50/50' : ''}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-2 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t text-sm text-gray-500 flex justify-between">
        <span>{table.getFilteredRowModel().rows.length} slots · {filteredHours} hrs total</span>
      </div>
    </div>
  )
}

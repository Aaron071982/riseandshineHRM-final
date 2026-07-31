'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type {
  ScheduleWorkspaceData,
  ScheduleSlot,
  ViewMode,
  RowDimension,
} from '@/lib/schedule/types'
import { findConflicts, hoursOf, fmtH } from '@/lib/schedule/utils'
import { downloadScheduleExport } from '@/lib/schedule/export'
import { CLIENT_BOROUGH_OPTIONS } from '@/lib/schedule-import/boroughOptions'
import type { SchedulePeriod } from '@/lib/schedule-import/types'
import { useToast } from '@/components/ui/toast'
import ScheduleToolbar from './ScheduleToolbar'
import RosterView from './RosterView'
import TableView from './TableView'
import ClientHoursPanel from './ClientHoursPanel'
import SessionEditor from './SessionEditor'
import ManageDialog from './ManageDialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react'

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create'; defaults?: Partial<ScheduleSlot> }
  | { mode: 'edit'; slot: ScheduleSlot }

type InitialData = ScheduleWorkspaceData & {
  periodStart?: string | null
  periodEnd?: string | null
  unsetClientCount?: number
  fromAssignments?: boolean
}

export default function ScheduleWorkspace({
  initial,
  periods = [],
  initialBorough = '',
}: {
  initial: InitialData
  periods?: SchedulePeriod[]
  initialBorough?: string
}) {
  const { showToast } = useToast()
  const router = useRouter()
  const [therapists, setTherapists] = useState(initial.therapists)
  const [clients, setClients] = useState(initial.clients)
  const [slots, setSlots] = useState(initial.slots)
  const [allowedUsers, setAllowedUsers] = useState(initial.allowedUsers)
  const [periodStart, setPeriodStart] = useState(initial.periodStart ?? null)
  const [periodEnd, setPeriodEnd] = useState(initial.periodEnd ?? null)
  const [periodList, setPeriodList] = useState(periods)
  const [unsetClientCount, setUnsetClientCount] = useState(initial.unsetClientCount ?? 0)
  const [borough, setBorough] = useState(initialBorough)
  const [view, setView] = useState<ViewMode>('roster')
  const [rowDim, setRowDim] = useState<RowDimension>('therapist')
  const [search, setSearch] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)
  const [showAllRows, setShowAllRows] = useState(false)
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [manageOpen, setManageOpen] = useState(false)

  const visibleSlots = useMemo(
    () => (showCancelled ? slots : slots.filter((s) => s.status !== 'CANCELLED')),
    [slots, showCancelled]
  )

  const conflicts = useMemo(() => findConflicts(visibleSlots), [visibleSlots])

  const stats = useMemo(() => {
    const active = visibleSlots.filter((s) => s.status !== 'CANCELLED')
    const totalHours = active.reduce((acc, s) => acc + hoursOf(s), 0)
    return {
      slotCount: active.length,
      totalHours: fmtH(totalHours),
      therapistCount: therapists.filter((t) => t.active).length,
      clientCount: clients.filter((c) => c.active).length,
      conflictCount: conflicts.size,
    }
  }, [visibleSlots, therapists, clients, conflicts])

  const refreshFromServer = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (periodStart) params.set('periodStart', periodStart)
      if (periodEnd) params.set('periodEnd', periodEnd)
      if (borough) params.set('borough', borough)
      const res = await fetch(`/api/schedule/periods?${params}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setTherapists(data.therapists)
      setClients(data.clients)
      setSlots(data.slots)
      setAllowedUsers(data.allowedUsers ?? [])
      setPeriodStart(data.periodStart)
      setPeriodEnd(data.periodEnd)
      setUnsetClientCount(data.unsetClientCount ?? 0)
      if (data.periods) setPeriodList(data.periods)
    } catch {
      // ignore
    }
  }, [periodStart, periodEnd, borough])

  useEffect(() => {
    void refreshFromServer()
  }, [borough]) // eslint-disable-line react-hooks/exhaustive-deps

  const navigatePeriod = (dir: -1 | 1) => {
    if (!periodList.length || !periodStart) return
    const idx = periodList.findIndex(
      (p) => p.periodStart === periodStart && p.periodEnd === periodEnd
    )
    const next = periodList[idx < 0 ? 0 : idx + dir]
    if (!next) return
    setPeriodStart(next.periodStart)
    setPeriodEnd(next.periodEnd)
    router.push(
      `/schedule?periodStart=${next.periodStart}&periodEnd=${next.periodEnd}${borough ? `&borough=${encodeURIComponent(borough)}` : ''}`
    )
  }

  const onSlotSaved = useCallback(
    (slot: ScheduleSlot, isNew: boolean) => {
      setSlots((prev) => {
        const idx = prev.findIndex((s) => s.id === slot.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = slot
          return next
        }
        return [...prev, slot]
      })
      showToast(isNew ? 'Session added' : 'Session updated', 'success')
      void refreshFromServer()
    },
    [showToast, refreshFromServer]
  )

  const onSlotDeleted = useCallback(
    (id: string) => {
      setSlots((prev) => prev.filter((s) => s.id !== id))
      showToast('Session deleted', 'success')
      void refreshFromServer()
    },
    [showToast, refreshFromServer]
  )

  const openCreate = (defaults?: Partial<ScheduleSlot>) =>
    setEditor({ mode: 'create', defaults })
  const openEdit = (slot: ScheduleSlot) => setEditor({ mode: 'edit', slot })
  const closeEditor = () => setEditor({ mode: 'closed' })

  const filteredSlots = useMemo(() => {
    if (!search.trim()) return visibleSlots
    const q = search.toLowerCase()
    const tMap = new Map(therapists.map((t) => [t.id, t.name]))
    const cMap = new Map(clients.map((c) => [c.id, c.name]))
    return visibleSlots.filter((s) => {
      const tn = tMap.get(s.therapistId)?.toLowerCase() ?? ''
      const cn = cMap.get(s.clientId)?.toLowerCase() ?? ''
      return tn.includes(q) || cn.includes(q) || s.day.toLowerCase().includes(q)
    })
  }, [visibleSlots, search, therapists, clients])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E4E8E9] dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!periodList.length}
            onClick={() => navigatePeriod(1)}
            title="Older period"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm">
            <span className="font-medium text-[#0E4D52]">
              {periodStart && periodEnd
                ? `${periodStart} → ${periodEnd}`
                : 'Weekly template (no import yet)'}
            </span>
            {periodList.length > 0 && (
              <select
                className="ml-2 h-8 rounded border px-2 text-xs max-w-[14rem]"
                value={periodStart && periodEnd ? `${periodStart}|${periodEnd}` : ''}
                onChange={(e) => {
                  const [ps, pe] = e.target.value.split('|')
                  if (!ps || !pe) return
                  router.push(
                    `/schedule?periodStart=${ps}&periodEnd=${pe}${borough ? `&borough=${encodeURIComponent(borough)}` : ''}`
                  )
                }}
              >
                {periodList.map((p) => (
                  <option key={p.id} value={`${p.periodStart}|${p.periodEnd}`}>
                    {p.periodStart} – {p.periodEnd} ({p.slotCount} slots)
                  </option>
                ))}
              </select>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!periodList.length}
            onClick={() => navigatePeriod(-1)}
            title="Newer period"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500 flex items-center gap-1">
            Client borough
            <select
              className="h-8 rounded border px-2 text-sm"
              value={borough}
              onChange={(e) => {
                const v = e.target.value
                setBorough(v)
                const q = new URLSearchParams()
                if (periodStart) q.set('periodStart', periodStart)
                if (periodEnd) q.set('periodEnd', periodEnd)
                if (v) q.set('borough', v)
                router.push(`/schedule?${q}`)
              }}
            >
              <option value="">All</option>
              {CLIENT_BOROUGH_OPTIONS.filter((b) => b !== 'Other').map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          {unsetClientCount > 0 && (
            <Link
              href="/schedule/import"
              className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1"
            >
              Unset boroughs: {unsetClientCount} clients
            </Link>
          )}
          <Button size="sm" className="bg-[#0D9488] hover:bg-teal-700" asChild>
            <Link href="/schedule/import">
              <Upload className="w-4 h-4 mr-1" />
              Import Artemis
            </Link>
          </Button>
        </div>
      </div>

      <ScheduleToolbar
        stats={stats}
        view={view}
        onViewChange={setView}
        rowDim={rowDim}
        onRowDimChange={setRowDim}
        search={search}
        onSearchChange={setSearch}
        showCancelled={showCancelled}
        onShowCancelledChange={setShowCancelled}
        showAllRows={showAllRows}
        onShowAllRowsChange={setShowAllRows}
        onAddSession={() => openCreate()}
        onManage={() => setManageOpen(true)}
        onExport={() => {
          void (async () => {
            try {
              const counts = await downloadScheduleExport(filteredSlots, therapists, clients)
              const filterNote = borough ? ` (borough: ${borough})` : ' (all)'
              if (counts.unassignedRbts > 0) {
                showToast(
                  `Exported${filterNote} — ${counts.unassignedRbts} RBTs still need a borough`,
                  'error'
                )
              } else {
                showToast(`Schedule exported${filterNote}`, 'success')
              }
            } catch {
              showToast('Export failed', 'error')
            }
          })()
        }}
        onExportAll={() => {
          void (async () => {
            try {
              const params = new URLSearchParams()
              if (periodStart) params.set('periodStart', periodStart)
              if (periodEnd) params.set('periodEnd', periodEnd)
              const res = await fetch(`/api/schedule/periods?${params}`, { credentials: 'include' })
              if (!res.ok) throw new Error('load failed')
              const data = await res.json()
              await downloadScheduleExport(data.slots, data.therapists, data.clients)
              showToast('Exported all boroughs', 'success')
            } catch {
              showToast('Export all failed', 'error')
            }
          })()
        }}
      />

      {view === 'roster' && (
        <RosterView
          therapists={therapists}
          clients={clients}
          slots={filteredSlots}
          rowDim={rowDim}
          onEditSlot={openEdit}
          onAddSlot={({ therapistId, clientId, day }) =>
            openCreate({
              therapistId,
              clientId,
              day: day as ScheduleSlot['day'],
            })
          }
        />
      )}

      {view === 'table' && (
        <TableView
          therapists={therapists}
          clients={clients}
          slots={filteredSlots}
          conflicts={conflicts}
          onEdit={openEdit}
          onRefresh={refreshFromServer}
          onAdd={() => openCreate()}
        />
      )}

      {view === 'hours' && (
        <ClientHoursPanel clients={clients} slots={visibleSlots} onRefresh={refreshFromServer} />
      )}

      {(editor.mode === 'create' || editor.mode === 'edit') && (
        <SessionEditor
          mode={editor.mode}
          slot={editor.mode === 'edit' ? editor.slot : undefined}
          defaults={editor.mode === 'create' ? editor.defaults : undefined}
          therapists={therapists.filter((t) => t.active)}
          clients={clients.filter((c) => c.active)}
          conflicts={conflicts}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onClose={closeEditor}
          onSaved={onSlotSaved}
          onDeleted={onSlotDeleted}
        />
      )}

      <ManageDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        therapists={therapists}
        clients={clients}
        allowedUsers={allowedUsers}
        onRefresh={refreshFromServer}
      />
    </div>
  )
}

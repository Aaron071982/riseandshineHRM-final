'use client'

import { useMemo, useState, useCallback } from 'react'
import type {
  ScheduleWorkspaceData,
  ScheduleSlot,
  ViewMode,
  RowDimension,
} from '@/lib/schedule/types'
import { findConflicts, hoursOf, fmtH } from '@/lib/schedule/utils'
import { downloadScheduleCsv } from '@/lib/schedule/export'
import { useToast } from '@/components/ui/toast'
import ScheduleToolbar from './ScheduleToolbar'
import RosterView from './RosterView'
import TableView from './TableView'
import ClientHoursPanel from './ClientHoursPanel'
import SessionEditor from './SessionEditor'
import ManageDialog from './ManageDialog'

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create'; defaults?: Partial<ScheduleSlot> }
  | { mode: 'edit'; slot: ScheduleSlot }

export default function ScheduleWorkspace({ initial }: { initial: ScheduleWorkspaceData }) {
  const { showToast } = useToast()
  const [therapists, setTherapists] = useState(initial.therapists)
  const [clients, setClients] = useState(initial.clients)
  const [slots, setSlots] = useState(initial.slots)
  const [allowedUsers, setAllowedUsers] = useState(initial.allowedUsers)
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
      const res = await fetch('/api/schedule/data', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setTherapists(data.therapists)
      setClients(data.clients)
      setSlots(data.slots)
      setAllowedUsers(data.allowedUsers ?? data.allowedEmails?.map((e: string) => ({ id: e, email: e })))
    } catch {
      // ignore
    }
  }, [])

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
          downloadScheduleCsv(filteredSlots, therapists, clients)
          showToast('Schedule exported', 'success')
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

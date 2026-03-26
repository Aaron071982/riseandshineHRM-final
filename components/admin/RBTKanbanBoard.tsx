'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { ChevronDown, ChevronRight, Calendar, UserX, UserCheck } from 'lucide-react'

const COLUMN_COLLAPSE_KEY = 'rbt-kanban-column-collapsed'

export interface RBTKanbanProfile {
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
  updatedAt: Date | string
  user: { role: string; isActive: boolean }
}

const KANBAN_COLUMNS: { id: string; label: string; statuses: string[] }[] = [
  { id: 'NEW', label: 'New', statuses: ['NEW'] },
  { id: 'REACH_OUT', label: 'Reach Out', statuses: ['REACH_OUT', 'REACH_OUT_EMAIL_SENT'] },
  { id: 'TO_INTERVIEW', label: 'To Interview', statuses: ['TO_INTERVIEW'] },
  { id: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled', statuses: ['INTERVIEW_SCHEDULED'] },
  { id: 'INTERVIEW_COMPLETED', label: 'Interview Completed', statuses: ['INTERVIEW_COMPLETED'] },
  { id: 'HIRED', label: 'Hired', statuses: ['HIRED'] },
  { id: 'ONBOARDING_COMPLETED', label: 'Onboarding Completed', statuses: ['ONBOARDING_COMPLETED'] },
  { id: 'REJECTED', label: 'Rejected', statuses: ['REJECTED'] },
  { id: 'STALLED', label: 'Stalled', statuses: ['STALLED'] },
]

function getColumnIdForStatus(status: string): string {
  const col = KANBAN_COLUMNS.find((c) => c.statuses.includes(status))
  return col?.id ?? 'NEW'
}

function getStatusForColumn(columnId: string): string {
  const col = KANBAN_COLUMNS.find((c) => c.id === columnId)
  return col?.statuses[0] ?? columnId
}

function daysInStage(updatedAt: Date | string): number {
  const d = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
}

function isStale(updatedAt: Date | string): boolean {
  return daysInStage(updatedAt) > 7
}

function profileHref(id: string, statusFilter: string, searchFilter: string): string {
  const q = new URLSearchParams()
  if (statusFilter) q.set('status', statusFilter)
  if (searchFilter) q.set('search', searchFilter)
  const query = q.toString()
  return `/admin/rbts/${id}${query ? `?${query}` : ''}`
}

interface RBTKanbanBoardProps {
  rbts: RBTKanbanProfile[]
  statusFilter: string
  searchFilter?: string
  onRbtsChange?: (rbts: RBTKanbanProfile[]) => void
}

export default function RBTKanbanBoard({
  rbts: initialRbts,
  statusFilter,
  searchFilter = '',
  onRbtsChange,
}: RBTKanbanBoardProps) {
  const { showToast } = useToast()
  const [rbts, setRbts] = useState<RBTKanbanProfile[]>(initialRbts)
  const [hiredModal, setHiredModal] = useState<{
    open: boolean
    rbt: RBTKanbanProfile | null
    sourceColumnId: string
  }>({ open: false, rbt: null, sourceColumnId: '' })

  useEffect(() => {
    setRbts(initialRbts)
  }, [initialRbts])

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = localStorage.getItem(COLUMN_COLLAPSE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>
        return parsed
      }
    } catch {}
    return {}
  })

  const toggleCollapsed = useCallback((columnId: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [columnId]: !prev[columnId] }
      try {
        localStorage.setItem(COLUMN_COLLAPSE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const cardsByColumn = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.id] = rbts.filter((r) => col.statuses.includes(r.status))
    return acc
  }, {} as Record<string, RBTKanbanProfile[]>)

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return
      const sourceCol = result.source.droppableId
      const destCol = result.destination.droppableId
      if (sourceCol === destCol) return

      const rbtId = result.draggableId
      const rbt = rbts.find((r) => r.id === rbtId)
      if (!rbt) return

      const newStatus = getStatusForColumn(destCol)

      if (destCol === 'HIRED') {
        setHiredModal({ open: true, rbt, sourceColumnId: sourceCol })
        return
      }

      const previous = rbts.map((r) => ({ ...r }))
      setRbts((prev) =>
        prev.map((r) => (r.id === rbtId ? { ...r, status: newStatus, updatedAt: new Date().toISOString() } : r))
      )
      onRbtsChange?.(rbts.map((r) => (r.id === rbtId ? { ...r, status: newStatus } : r)))

      const res = await fetch(`/api/admin/rbts/${rbtId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data?.error || 'Failed to update status', 'error')
        setRbts(previous)
        onRbtsChange?.(previous)
      }
    },
    [rbts, onRbtsChange, showToast]
  )

  const handleConfirmHire = useCallback(async () => {
    const { rbt, sourceColumnId } = hiredModal
    if (!rbt) return
    setHiredModal((prev) => ({ ...prev, open: false, rbt: null }))

    const res = await fetch(`/api/admin/rbts/${rbt.id}/hire`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) {
      setRbts((prev) =>
        prev.map((r) => (r.id === rbt.id ? { ...r, status: 'HIRED', updatedAt: new Date().toISOString() } : r))
      )
      onRbtsChange?.(rbts.map((r) => (r.id === rbt.id ? { ...r, status: 'HIRED' } : r)))
      showToast('Candidate hired successfully', 'success')
    } else {
      const data = await res.json().catch(() => ({}))
      showToast(data?.error || 'Failed to hire candidate', 'error')
    }
  }, [hiredModal, rbts, onRbtsChange, showToast])

  const handleCancelHire = useCallback(() => {
    setHiredModal({ open: false, rbt: null, sourceColumnId: '' })
  }, [])

  const handleQuickStatus = useCallback(
    async (rbtId: string, newStatus: string) => {
      const rbt = rbts.find((r) => r.id === rbtId)
      if (!rbt) return
      const previous = rbts.map((r) => ({ ...r }))
      setRbts((prev) =>
        prev.map((r) => (r.id === rbtId ? { ...r, status: newStatus, updatedAt: new Date().toISOString() } : r))
      )
      const res = await fetch(`/api/admin/rbts/${rbtId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data?.error || 'Failed to update status', 'error')
        setRbts(previous)
      }
    },
    [rbts, showToast]
  )

  const handleReject = useCallback(
    async (rbtId: string) => {
      const res = await fetch(`/api/admin/rbts/${rbtId}/reject`, { method: 'POST', credentials: 'include' })
      if (res.ok) {
        setRbts((prev) =>
          prev.map((r) => (r.id === rbtId ? { ...r, status: 'REJECTED', updatedAt: new Date().toISOString() } : r))
        )
        showToast('Candidate rejected', 'success')
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data?.error || 'Failed to reject', 'error')
      }
    },
    [showToast]
  )

  const dimColumn = statusFilter && statusFilter.length > 0

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 250px)' }}>
          <div className="flex gap-4 min-w-max">
            {KANBAN_COLUMNS.map((col) => {
              const cards = cardsByColumn[col.id] ?? []
              const isDimmed = dimColumn && statusFilter !== col.id && !col.statuses.includes(statusFilter)
              const isCollapsed = collapsed[col.id]

              return (
                <div
                  key={col.id}
                  className={`flex-shrink-0 w-[280px] flex flex-col rounded-xl border bg-gray-100/80 dark:bg-[var(--bg-elevated)] dark:border-[var(--border-subtle)] transition-opacity ${isDimmed ? 'opacity-50' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(col.id)}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-t-xl bg-orange-500 text-white font-medium text-left"
                  >
                    <span className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {col.label}
                    </span>
                    <span className="bg-white/20 rounded-full px-2 py-0.5 text-sm">{cards.length}</span>
                  </button>
                  {!isCollapsed && (
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex-1 overflow-y-auto p-2 border-t dark:border-[var(--border-subtle)]"
                          style={{ height: 'calc(100vh - 250px)', minHeight: 120 }}
                        >
                          {cards.length === 0 && !snapshot.isDraggingOver ? (
                            <div className="flex items-center justify-center h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-[var(--border-subtle)] text-gray-500 dark:text-[var(--text-tertiary)] text-sm">
                              No candidates
                            </div>
                          ) : (
                            cards.map((rbt, idx) => (
                              <Draggable key={rbt.id} draggableId={rbt.id} index={idx}>
                                {(providedCard, snapshotCard) => (
                                  <div
                                    ref={providedCard.innerRef}
                                    {...providedCard.draggableProps}
                                    {...providedCard.dragHandleProps}
                                    className={`mb-2 rounded-lg border bg-white dark:bg-[var(--bg-primary)] dark:border-[var(--border-subtle)] shadow-sm p-3 ${isStale(rbt.updatedAt) ? 'border-l-4 border-amber-400' : ''} ${snapshotCard.isDragging ? 'shadow-md ring-2 ring-orange-300' : ''}`}
                                  >
                                    <p className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">
                                      {rbt.firstName} {rbt.lastName}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)] mt-0.5">
                                      {rbt.phoneNumber}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
                                      {rbt.locationCity && rbt.locationState
                                        ? `${rbt.locationCity}, ${rbt.locationState}`
                                        : rbt.zipCode || '—'}
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {rbt.source === 'PUBLIC_APPLICATION' ? (
                                        <Badge className="bg-orange-50 text-orange-700 dark:bg-[var(--orange-subtle)] dark:text-[var(--orange-primary)] border-0 text-xs">
                                          Applied Online
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs">
                                          Admin Created
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-[var(--text-disabled)] mt-2">
                                      {daysInStage(rbt.updatedAt)} day{daysInStage(rbt.updatedAt) !== 1 ? 's' : ''} in this stage
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <Link href={profileHref(rbt.id, statusFilter, searchFilter)}>
                                        <Button size="sm" variant="outline" className="text-xs dark:border-[var(--border-subtle)] dark:text-[var(--text-secondary)] dark:hover:border-[var(--orange-primary)] dark:hover:text-[var(--orange-primary)]">
                                          View Profile
                                        </Button>
                                      </Link>
                                      {rbt.status === 'NEW' && (
                                        <Button
                                          size="sm"
                                          className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleQuickStatus(rbt.id, 'REACH_OUT')
                                          }}
                                        >
                                          Move to Reach Out
                                        </Button>
                                      )}
                                      {(rbt.status === 'REACH_OUT' || rbt.status === 'REACH_OUT_EMAIL_SENT') && (
                                        <Link href={profileHref(rbt.id, statusFilter, searchFilter)}>
                                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            Schedule Interview
                                          </Button>
                                        </Link>
                                      )}
                                      {rbt.status === 'INTERVIEW_COMPLETED' && (
                                        <>
                                          <Button
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setHiredModal({ open: true, rbt, sourceColumnId: getColumnIdForStatus(rbt.status) })
                                            }}
                                          >
                                            <UserCheck className="h-3 w-3 mr-1" />
                                            Hire
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            className="text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleReject(rbt.id)
                                            }}
                                          >
                                            <UserX className="h-3 w-3 mr-1" />
                                            Reject
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </DragDropContext>

      <Dialog open={hiredModal.open} onOpenChange={(open) => !open && handleCancelHire()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Mark {hiredModal.rbt ? `${hiredModal.rbt.firstName} ${hiredModal.rbt.lastName}` : 'this candidate'} as Hired?
            </DialogTitle>
            <DialogDescription>
              This will update their status and run the full hire process (set role to RBT, send welcome email if applicable).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelHire}>
              Cancel
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleConfirmHire}>
              Mark as Hired
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

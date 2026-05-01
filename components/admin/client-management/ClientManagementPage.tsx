'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { LayoutGrid, List, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import AddClientWizardModal from '@/components/admin/client-management/AddClientWizardModal'
import ImportClientsSection from '@/components/admin/client-management/ImportClientsSection'

const VIEW_KEY = 'cms-view-mode'

const COLUMNS: {
  id: string
  title: string
  headerClass: string
}[] = [
  { id: 'NEW_INTAKE', title: '🆕 New Intake', headerClass: 'bg-blue-600' },
  { id: 'WAITING', title: '⏳ Waiting for Services', headerClass: 'bg-amber-500' },
  { id: 'ACTIVE', title: '✅ Active', headerClass: 'bg-emerald-600' },
  { id: 'INACTIVE', title: '💤 Inactive', headerClass: 'bg-slate-500' },
]

export type ClientListItem = {
  id: string
  listName: string
  status: string
  age: number | null
  city: string | null
  state: string | null
  insuranceProvider: string | null
  authorizationEndDate: string | null
  authExpiryTone: 'green' | 'amber' | 'red'
  hoursAlert: boolean
  authorizedHoursPerWeek: number | null
  hasActiveRbt: boolean
  rbtInitials: string[]
  rbtCount: number
  bcbaName: string | null
}

type Stats = { total: number; active: number; waiting: number; newIntake: number }

export default function ClientManagementPage() {
  const { showToast } = useToast()
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast
  const [stats, setStats] = useState<Stats | null>(null)
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [addOpen, setAddOpen] = useState(false)
  const [sortKey, setSortKey] = useState<'name' | 'status' | 'auth' | 'rbts'>('name')
  const [pendingStatus, setPendingStatus] = useState<{
    id: string
    label: string
    toStatus: string
    reason: string
  } | null>(null)

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY)
      if (v === 'list' || v === 'kanban') setView(v)
    } catch {
      /* ignore */
    }
  }, [])

  const persistView = (v: 'kanban' | 'list') => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('limit', '200')
      const res = await fetch(`/api/admin/clients?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load')
      const data = await res.json()
      setStats(data.stats)
      setClients(data.clients)
    } catch (e) {
      showToastRef.current(`Error: ${String(e)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const clientsByColumn = useMemo(() => {
    const map: Record<string, ClientListItem[]> = {
      NEW_INTAKE: [],
      WAITING: [],
      ACTIVE: [],
      INACTIVE: [],
    }
    for (const c of clients) {
      if (map[c.status]) map[c.status].push(c)
    }
    return map
  }, [clients])

  const sortedList = useMemo(() => {
    const copy = [...clients]
    copy.sort((a, b) => {
      if (sortKey === 'name') return a.listName.localeCompare(b.listName)
      if (sortKey === 'status') return a.status.localeCompare(b.status)
      if (sortKey === 'auth') {
        const ae = a.authorizationEndDate ? new Date(a.authorizationEndDate).getTime() : Infinity
        const be = b.authorizationEndDate ? new Date(b.authorizationEndDate).getTime() : Infinity
        return ae - be
      }
      return a.rbtCount - b.rbtCount
    })
    return copy
  }, [clients, sortKey])

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result
    if (!destination) return
    const toStatus = destination.droppableId
    const client = clients.find((c) => c.id === draggableId)
    if (!client || client.status === toStatus) return
    setPendingStatus({
      id: draggableId,
      label: client.listName,
      toStatus,
      reason: '',
    })
  }

  const confirmStatusMove = async () => {
    if (!pendingStatus) return
    try {
      const res = await fetch(`/api/admin/clients/${pendingStatus.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toStatus: pendingStatus.toStatus,
          reason: pendingStatus.reason.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Update failed')
      showToast('Status updated', 'success')
      setPendingStatus(null)
      await load()
    } catch (e) {
      showToast(`Could not update status: ${String(e)}`, 'error')
    }
  }

  const columnTitle = (id: string) => COLUMNS.find((c) => c.id === id)?.title ?? id

  const authBorderClass = (tone: ClientListItem['authExpiryTone']) => {
    if (tone === 'red' || tone === 'amber') return 'border-l-4 border-l-amber-500'
    return ''
  }

  const CardInner = ({ c }: { c: ClientListItem }) => (
    <div
      className={cn(
        'rounded-lg border bg-white dark:bg-[var(--bg-elevated)] p-3 shadow-sm hover:shadow-md transition-shadow',
        !c.hasActiveRbt && 'border-l-4 border-l-red-500',
        c.hasActiveRbt && authBorderClass(c.authExpiryTone)
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">{c.listName}</p>
          <p className="text-xs text-gray-500">
            {c.age != null ? `${c.age} yrs` : '—'} · {[c.city, c.state].filter(Boolean).join(', ') || '—'}
          </p>
          <p className="text-xs mt-1 text-gray-600 truncate">{c.insuranceProvider ?? '—'}</p>
        </div>
        <Link href={`/admin/clients/${c.id}`}>
          <Button size="sm" variant="outline">
            View
          </Button>
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 items-center">
        {c.hasActiveRbt ? (
          c.rbtInitials.slice(0, 3).map((ini, i) => (
            <span
              key={i}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-800 text-xs font-bold"
            >
              {ini}
            </span>
          ))
        ) : (
          <Badge variant="destructive" className="text-xs">
            No RBT
          </Badge>
        )}
        {c.rbtCount > 3 && <span className="text-xs text-gray-500">+{c.rbtCount - 3}</span>}
      </div>
      <div className="mt-2 text-xs">
        <span className="text-gray-500">BCBA: </span>
        {c.bcbaName ? (
          <span className="font-medium">{c.bcbaName}</span>
        ) : (
          <Badge variant="destructive" className="text-xs">
            No BCBA
          </Badge>
        )}
      </div>
      {c.hoursAlert && (
        <Badge className="mt-2 bg-amber-100 text-amber-900 border-amber-300">Hours running low</Badge>
      )}
    </div>
  )

  return (
    <div className="space-y-6 pb-12">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 p-8 shadow-lg">
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-2">Client Management</h1>
          <p className="text-orange-50 text-lg">
            Manage client assignments and track service delivery
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-white dark:bg-[var(--bg-elevated)] p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Clients</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 shadow-sm">
            <p className="text-sm text-emerald-800 dark:text-emerald-200">Active</p>
            <p className="text-2xl font-bold text-emerald-700">{stats.active}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 p-4 shadow-sm">
            <p className="text-sm text-amber-900 dark:text-amber-200">Waiting for Services</p>
            <p className="text-2xl font-bold text-amber-800">{stats.waiting}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 dark:bg-blue-950/30 p-4 shadow-sm">
            <p className="text-sm text-blue-900 dark:text-blue-200">New Intake</p>
            <p className="text-2xl font-bold text-blue-800">{stats.newIntake}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <Input
          placeholder="Search name, guardian, insurance ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="NEW_INTAKE">New Intake</SelectItem>
              <SelectItem value="WAITING">Waiting</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add New Client
          </Button>
          <div className="flex rounded-lg border p-1 bg-gray-50 dark:bg-gray-900">
            <Button
              type="button"
              variant={view === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => persistView('kanban')}
            >
              <LayoutGrid className="w-4 h-4 mr-1" /> Kanban
            </Button>
            <Button
              type="button"
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => persistView('list')}
            >
              <List className="w-4 h-4 mr-1" /> List
            </Button>
          </div>
        </div>
      </div>

      <ImportClientsSection onImported={load} />

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        </div>
      ) : view === 'kanban' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {COLUMNS.map((col) => (
              <div key={col.id} className="rounded-xl border bg-gray-50 dark:bg-gray-900/40 overflow-hidden min-h-[200px]">
                <div
                  className={cn(
                    'px-3 py-2 text-white font-semibold flex justify-between items-center',
                    col.headerClass
                  )}
                >
                  <span>{col.title}</span>
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">
                    {clientsByColumn[col.id]?.length ?? 0}
                  </Badge>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'p-2 space-y-2 min-h-[120px]',
                        snapshot.isDraggingOver && 'bg-orange-50/50 dark:bg-orange-950/20'
                      )}
                    >
                      {(clientsByColumn[col.id] ?? []).map((c, index) => (
                        <Draggable key={c.id} draggableId={c.id} index={index}>
                          {(prov) => (
                            <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                              <CardInner c={c} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      ) : (
        <div className="rounded-xl border bg-white dark:bg-[var(--bg-elevated)] overflow-hidden shadow-sm">
          <div className="p-3 border-b flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500">Sort:</span>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="auth">Auth expiry</SelectItem>
                <SelectItem value="rbts">RBT count</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left p-3">Client</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Location</th>
                  <th className="text-left p-3">Insurance</th>
                  <th className="text-left p-3">Auth</th>
                  <th className="text-left p-3">RBTs</th>
                  <th className="text-left p-3">BCBA</th>
                  <th className="text-left p-3">Hrs/wk</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedList.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="p-3">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="font-medium text-orange-700 hover:underline"
                      >
                        {c.listName}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{c.status}</Badge>
                    </td>
                    <td className="p-3">
                      {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="p-3 max-w-[140px] truncate">{c.insuranceProvider ?? '—'}</td>
                    <td className="p-3">
                      {c.authorizationEndDate
                        ? new Date(c.authorizationEndDate).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="p-3">
                      {c.hasActiveRbt ? (
                        <span className="flex gap-1 flex-wrap">
                          {c.rbtInitials.map((x, i) => (
                            <span
                              key={i}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold"
                            >
                              {x}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold">None</span>
                      )}
                    </td>
                    <td className="p-3">{c.bcbaName ?? <span className="text-red-600">None</span>}</td>
                    <td className="p-3">
                      {c.authorizedHoursPerWeek != null ? c.authorizedHoursPerWeek : '—'}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link href={`/admin/clients/${c.id}`}>
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </Link>
                      <Link href={`/admin/clients/${c.id}?assign=1`}>
                        <Button size="sm" variant="secondary">
                          Quick Assign
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!pendingStatus} onOpenChange={(o) => !o && setPendingStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change client status</DialogTitle>
            <DialogDescription>
              Move <strong>{pendingStatus?.label}</strong> to{' '}
              <strong>{pendingStatus ? columnTitle(pendingStatus.toStatus) : ''}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Optional reason</Label>
            <Input
              value={pendingStatus?.reason ?? ''}
              onChange={(e) =>
                setPendingStatus((p) => (p ? { ...p, reason: e.target.value } : p))
              }
              placeholder="Reason for status change"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatus(null)}>
              Cancel
            </Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={confirmStatusMove}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddClientWizardModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Network, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ORG_DEPARTMENTS, SUB_DEPARTMENTS_BY_DEPARTMENT, type OrgDepartment } from '@/lib/org-chart-departments'
import OrgChartCanvas from '@/components/admin/org-chart/OrgChartCanvas'
import OrgChartMobileTree from '@/components/admin/org-chart/OrgChartMobileTree'
import OrgNodeDetailPanel from '@/components/admin/org-chart/OrgNodeDetailPanel'
import OrgNodeFormDialog from '@/components/admin/org-chart/OrgNodeFormDialog'
import type { OrgNodeDTO } from '@/components/admin/org-chart/types'

export default function OrgChartPage() {
  const [flatNodes, setFlatNodes] = useState<OrgNodeDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('All')
  const [subDepartmentFilter, setSubDepartmentFilter] = useState('All')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formParentId, setFormParentId] = useState<string | null>(null)
  const [editNodeId, setEditNodeId] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const exportHandlerRef = useRef<(() => Promise<void>) | null>(null)

  const fetchNodes = useCallback(async () => {
    const res = await fetch('/api/admin/org-chart', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load org chart')
    }
    const raw = Array.isArray(data.nodes) ? data.nodes : []
    setFlatNodes(
      raw.map((n: OrgNodeDTO) => ({
        ...n,
        subDepartment: n.subDepartment ?? null,
      }))
    )
    setSetupRequired(!!data.setupRequired)
    setSetupMessage(typeof data.setupMessage === 'string' ? data.setupMessage : null)
  }, [])

  const selectedNode = useMemo(
    () => (selectedNodeId ? flatNodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [flatNodes, selectedNodeId]
  )

  const editNode = useMemo(
    () => (editNodeId ? flatNodes.find((n) => n.id === editNodeId) ?? null : null),
    [flatNodes, editNodeId]
  )

  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    fetchNodes()
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [fetchNodes])

  useEffect(() => {
    setSubDepartmentFilter('All')
  }, [departmentFilter])

  const handleDelete = useCallback(
    async (id: string) => {
      if (
        !window.confirm(
          'Remove this person from the org chart? Their direct reports will move up to their current manager.'
        )
      ) {
        return
      }
      try {
        const res = await fetch(`/api/admin/org-chart/nodes/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          alert(data.error || 'Delete failed')
          return
        }
        if (Array.isArray(data.nodes)) {
          setFlatNodes(data.nodes)
        } else {
          await fetchNodes()
        }
        if (selectedNodeId === id) setSelectedNodeId(null)
        if (editNodeId === id) setEditNodeId(null)
      } catch {
        alert('Delete failed')
      }
    },
    [fetchNodes, selectedNodeId, editNodeId]
  )

  const handleReparent = useCallback(
    async (nodeId: string, newParentId: string | null) => {
      const res = await fetch(`/api/admin/org-chart/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parentId: newParentId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Could not move person')
        await fetchNodes()
        return
      }
      await fetchNodes()
    },
    [fetchNodes]
  )

  const openCreate = useCallback((parentId: string | null) => {
    setFormMode('create')
    setFormParentId(parentId)
    setEditNodeId(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((id: string) => {
    setFormMode('edit')
    setEditNodeId(id)
    setFormParentId(null)
    setFormOpen(true)
  }, [])

  const onAddChild = useCallback(
    (parentId: string) => {
      openCreate(parentId)
    },
    [openCreate]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600 dark:text-[var(--orange-primary)]" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <p className="font-medium">{loadError}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => {
            setLoading(true)
            setLoadError(null)
            fetchNodes()
              .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Failed to load'))
              .finally(() => setLoading(false))
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 px-5 py-6 text-white shadow-lg sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-white/15 p-2">
              <Network className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Company Hierarchy</h1>
              <p className="mt-1 text-sm text-white/90">Rise and Shine ABA organizational structure</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="hidden bg-white/95 text-orange-700 hover:bg-white md:inline-flex"
              onClick={() => exportHandlerRef.current?.()}
            >
              Export PNG
            </Button>
            <Button
              type="button"
              variant={editMode ? 'default' : 'secondary'}
              className={
                editMode
                  ? 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900'
                  : 'bg-white/95 text-orange-700 hover:bg-white'
              }
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? 'Done' : 'Edit chart'}
            </Button>
          </div>
        </div>
      </div>

      {setupRequired && setupMessage ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <p className="font-medium">Database setup needed</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">{setupMessage}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search name, title, email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={setupRequired}
            className="pl-9 dark:bg-[var(--bg-elevated)]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['All', ...ORG_DEPARTMENTS] as const).map((d) => (
            <button
              key={d}
              type="button"
              disabled={setupRequired}
              onClick={() => setDepartmentFilter(d)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition',
                departmentFilter === d
                  ? 'bg-orange-500 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[var(--bg-elevated)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]'
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {departmentFilter !== 'All' ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-500 dark:text-[var(--text-tertiary)]">Subgroup</p>
          <div className="flex flex-wrap gap-2">
            {(['All', ...SUB_DEPARTMENTS_BY_DEPARTMENT[departmentFilter as OrgDepartment], 'Unassigned'] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={setupRequired}
                onClick={() => setSubDepartmentFilter(s)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition',
                  subDepartmentFilter === s
                    ? 'bg-violet-600 text-white shadow dark:bg-violet-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[var(--bg-elevated)] dark:text-[var(--text-secondary)] dark:hover:bg-[var(--bg-elevated-hover)]'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {flatNodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 dark:border-[var(--border-medium)] dark:bg-[var(--bg-elevated)]">
          <Image src="/new-real-logo.png" alt="Rise and Shine" width={80} height={80} className="opacity-90" />
          <p className="mt-6 max-w-sm text-center text-gray-600 dark:text-[var(--text-tertiary)]">
            {setupRequired
              ? 'Create the org_nodes table in your database (see the notice above), then you can add people here.'
              : 'No org chart yet. Add your first person to map how your team connects.'}
          </p>
          <Button
            type="button"
            className="mt-6"
            disabled={setupRequired}
            title={setupRequired ? 'Run the SQL migration first' : undefined}
            onClick={() => openCreate(null)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add first person
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <OrgChartCanvas
              flatNodes={flatNodes}
              editMode={editMode}
              selectedNodeId={selectedNodeId}
              searchQuery={searchQuery}
              departmentFilter={departmentFilter}
              subDepartmentFilter={subDepartmentFilter}
              onSelectNode={setSelectedNodeId}
              onEdit={openEdit}
              onDelete={handleDelete}
              onAddChild={onAddChild}
              onReparent={handleReparent}
              exportHandlerRef={exportHandlerRef}
            />
          </div>
          <div className="md:hidden">
            <OrgChartMobileTree
              nodes={flatNodes}
              departmentFilter={departmentFilter}
              subDepartmentFilter={subDepartmentFilter}
              search={searchQuery}
              onSelectNode={(id) => setSelectedNodeId(id)}
            />
          </div>
        </>
      )}

      {editMode && flatNodes.length > 0 && !setupRequired ? (
        <Button
          type="button"
          size="lg"
          className="fixed bottom-8 right-6 z-30 h-14 w-14 rounded-full p-0 shadow-lg"
          onClick={() => openCreate(null)}
          aria-label="Add person"
        >
          <Plus className="h-6 w-6" />
        </Button>
      ) : null}

      <OrgNodeDetailPanel
        node={selectedNode}
        rows={flatNodes}
        open={!!selectedNodeId && !!selectedNode}
        onClose={() => setSelectedNodeId(null)}
        onSelectNode={(id) => setSelectedNodeId(id)}
      />

      <OrgNodeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialParentId={formMode === 'create' ? formParentId : editNode?.parentId ?? null}
        editNode={formMode === 'edit' ? editNode : null}
        flatNodes={flatNodes}
        onSaved={() => {
          void fetchNodes()
        }}
      />
    </div>
  )
}

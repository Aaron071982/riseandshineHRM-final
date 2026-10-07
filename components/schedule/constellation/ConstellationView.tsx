'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeDragHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { RotateCcw } from 'lucide-react'
import type { ScheduleClient, ScheduleSlot, ScheduleTherapist } from '@/lib/schedule/types'
import {
  BAND_META,
  UTILIZATION_BANDS,
  buildConstellationModel,
  resolveWeeklyTarget,
  slotsLabel,
  type CapacityTarget,
  type UtilizationBand,
} from '@/lib/schedule/constellation'
import {
  connectedComponents,
  layoutConstellation,
  trayPositions,
  type LayoutLink,
  type LayoutNode,
  type LayoutResult,
  type Point,
} from '@/lib/schedule/constellationLayout'
import { getTherapistCapacityTargets, type TherapistCapacityRow } from '@/lib/schedule/capacityActions'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import AssignmentEdge from './AssignmentEdge'
import ConstellationPanel, { type PanelSelection } from './ConstellationPanel'
import ReassignDialog, { type ReassignRequest } from './ReassignDialog'
import { ClientNode, GroupLabelNode, TherapistNode, TherapistTrayNode } from './nodes'
import {
  CLIENT_NODE,
  ConstellationUiContext,
  THERAPIST_NODE,
  TRAY_NODE,
  clientNodeId,
  edgeId,
  therapistNodeId,
  type ConstellationUi,
} from './context'

const nodeTypes = {
  therapist: TherapistNode,
  therapistTray: TherapistTrayNode,
  client: ClientNode,
  groupLabel: GroupLabelNode,
}
const edgeTypes = { assignment: AssignmentEdge }

/** Layouts survive tab switches; keyed by period + visible graph. */
const layoutCache = new Map<string, LayoutResult>()

const positionsStorageKey = (periodKey: string) => `schedule-constellation:positions:${periodKey}`

function loadSavedPositions(periodKey: string): Record<string, Point> {
  try {
    const raw = localStorage.getItem(positionsStorageKey(periodKey))
    return raw ? (JSON.parse(raw) as Record<string, Point>) : {}
  } catch {
    return {}
  }
}

function toTarget(row: TherapistCapacityRow): CapacityTarget {
  return { ...resolveWeeklyTarget(row), preferredHoursRange: row.preferredHoursRange }
}

export type ConstellationViewProps = {
  therapists: ScheduleTherapist[]
  clients: ScheduleClient[]
  slots: ScheduleSlot[]
  conflicts: Map<string, string[]>
  search: string
  periodStart: string | null
  periodEnd: string | null
  borough: string
  onEditSlot: (slot: ScheduleSlot) => void
  onAddSlot: (defaults: Partial<ScheduleSlot>) => void
  onSlotSaved: (slot: ScheduleSlot, isNew: boolean) => void
  onSlotDeleted: (id: string) => void
  onRefresh: () => Promise<void> | void
  onNarrowScreen: () => void
}

export default function ConstellationView(props: ConstellationViewProps) {
  return (
    <ReactFlowProvider>
      <ConstellationInner {...props} />
    </ReactFlowProvider>
  )
}

function ConstellationInner({
  therapists,
  clients,
  slots,
  conflicts,
  search,
  periodStart,
  periodEnd,
  borough,
  onEditSlot,
  onAddSlot,
  onSlotSaved,
  onSlotDeleted,
  onRefresh,
  onNarrowScreen,
}: ConstellationViewProps) {
  const { showToast } = useToast()
  const { fitView, getIntersectingNodes } = useReactFlow()
  const periodKey = `${periodStart ?? 'template'}|${periodEnd ?? ''}`

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    if (!mq.matches) onNarrowScreen()
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) onNarrowScreen()
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [onNarrowScreen])

  // ── Capacity targets ────────────────────────────────────────────────
  const [targets, setTargets] = useState<Map<string, CapacityTarget>>(new Map())
  const [canEditTarget, setCanEditTarget] = useState(false)
  const therapistIdsKey = useMemo(() => therapists.map((t) => t.id).sort().join(','), [therapists])
  useEffect(() => {
    let cancelled = false
    const ids = therapistIdsKey ? therapistIdsKey.split(',') : []
    getTherapistCapacityTargets(ids)
      .then(({ rows, canEdit }) => {
        if (cancelled) return
        setTargets(new Map(rows.map((r) => [r.id, toTarget(r)])))
        setCanEditTarget(canEdit)
      })
      .catch(() => {
        if (!cancelled) showToast('Could not load capacity targets — showing 40 hr default', 'error')
      })
    return () => {
      cancelled = true
    }
  }, [therapistIdsKey, showToast])

  const model = useMemo(
    () => buildConstellationModel({ therapists, clients, slots, conflicts, targets }),
    [therapists, clients, slots, conflicts, targets]
  )

  // ── Filters ─────────────────────────────────────────────────────────
  const [bands, setBands] = useState<Set<UtilizationBand>>(new Set(UTILIZATION_BANDS))
  const [conflictsOnly, setConflictsOnly] = useState(false)
  const [clientFilter, setClientFilter] = useState('')
  const [groupByBorough, setGroupByBorough] = useState(false)
  const [showUnassigned, setShowUnassigned] = useState(false)

  const bandCounts = useMemo(() => {
    const out: Record<UtilizationBand, number> = { over: 0, near: 0, healthy: 0, under: 0 }
    for (const tm of model.therapists.values()) if (tm.pairKeys.length) out[tm.band]++
    return out
  }, [model])

  const conflictPairCount = useMemo(
    () => [...model.pairs.values()].filter((p) => p.conflictReasons.length > 0).length,
    [model]
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const pairs = [...model.pairs.values()].filter((p) => {
      const tm = model.therapists.get(p.therapistId)
      const cm = model.clients.get(p.clientId)
      if (!tm || !cm) return false
      if (!bands.has(tm.band)) return false
      if (conflictsOnly && p.conflictReasons.length === 0) return false
      if (clientFilter && p.clientId !== clientFilter) return false
      if (q) {
        const hay = `${tm.therapist.name} ${cm.client.name} ${cm.client.code ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const therapistIds = [...new Set(pairs.map((p) => p.therapistId))].sort()
    const clientIds = [...new Set(pairs.map((p) => p.clientId))].sort()
    const unassignedAll = [...model.therapists.values()]
      .filter((tm) => tm.pairKeys.length === 0)
      .sort((a, b) => a.therapist.name.localeCompare(b.therapist.name))
    const unassigned = q ? unassignedAll.filter((tm) => tm.therapist.name.toLowerCase().includes(q)) : unassignedAll
    return { pairs, therapistIds, clientIds, unassigned, unassignedTotal: unassignedAll.length }
  }, [model, bands, conflictsOnly, clientFilter, search])

  // ── Layout (memoised per period + graph shape) ──────────────────────
  const [savedPositions, setSavedPositions] = useState<Record<string, Point>>({})
  useEffect(() => {
    setSavedPositions(loadSavedPositions(periodKey))
  }, [periodKey])

  const lastLayoutRef = useRef<Map<string, Point>>(new Map())
  const layout = useMemo(() => {
    const layoutNodes: LayoutNode[] = []
    const links: LayoutLink[] = visible.pairs.map((p) => ({
      source: therapistNodeId(p.therapistId),
      target: clientNodeId(p.clientId),
    }))
    for (const id of visible.therapistIds) {
      layoutNodes.push({ id: therapistNodeId(id), ...THERAPIST_NODE, group: '' })
    }
    for (const id of visible.clientIds) {
      layoutNodes.push({ id: clientNodeId(id), ...CLIENT_NODE, group: '' })
    }
    if (groupByBorough) {
      for (const n of layoutNodes) {
        if (n.id.startsWith('t:')) n.group = model.therapists.get(n.id.slice(2))?.primaryBorough ?? 'Unset'
        else n.group = model.clients.get(n.id.slice(2))?.client.borough ?? 'Unset'
      }
    } else {
      const comp = connectedComponents(layoutNodes.map((n) => n.id), links)
      for (const n of layoutNodes) n.group = comp.get(n.id) ?? n.id
    }

    const signature = `${periodKey}#${groupByBorough ? 'b' : 'c'}#${layoutNodes.map((n) => `${n.id}@${n.group}`).join(',')}#${links
      .map((l) => `${l.source}>${l.target}`)
      .join(',')}`
    let result = layoutCache.get(signature)
    if (!result) {
      result = layoutConstellation(layoutNodes, links, {
        seed: lastLayoutRef.current.size ? lastLayoutRef.current : undefined,
        groupHeader: groupByBorough ? 40 : 0,
      })
      layoutCache.set(signature, result)
    }
    lastLayoutRef.current = result.positions
    return result
  }, [visible, groupByBorough, model, periodKey])

  // ── Nodes & edges ───────────────────────────────────────────────────
  const baseNodes = useMemo(() => {
    const out: Node[] = []
    const pos = (id: string) => savedPositions[id] ?? layout.positions.get(id) ?? { x: 0, y: 0 }
    if (groupByBorough) {
      for (const g of layout.groups) {
        const n = visible.clientIds.filter((id) => (model.clients.get(id)?.client.borough ?? 'Unset') === g.id).length
        out.push({
          id: `g:${g.id}`,
          type: 'groupLabel',
          position: { x: g.x, y: g.y },
          data: { label: g.id === 'Unset' ? 'Borough unset' : g.id, sub: `${n} client${n === 1 ? '' : 's'}` },
          draggable: false,
          selectable: false,
          connectable: false,
        })
      }
    }
    for (const id of visible.therapistIds) {
      const tm = model.therapists.get(id)
      if (!tm) continue
      const nid = therapistNodeId(id)
      out.push({ id: nid, type: 'therapist', position: pos(nid), data: { model: tm } })
    }
    for (const id of visible.clientIds) {
      const cm = model.clients.get(id)
      if (!cm) continue
      const nid = clientNodeId(id)
      out.push({ id: nid, type: 'client', position: pos(nid), data: { model: cm } })
    }
    if (showUnassigned && visible.unassigned.length) {
      const originY = layout.bounds.h + 150
      out.push({
        id: 'g:__tray',
        type: 'groupLabel',
        position: { x: 0, y: originY - 44 },
        data: {
          label: `Unassigned therapists (${visible.unassigned.length})`,
          sub: 'No sessions this period — drop a client here to propose a move',
        },
        draggable: false,
        selectable: false,
        connectable: false,
      })
      const tray = trayPositions(
        visible.unassigned.map((tm) => therapistNodeId(tm.therapist.id)),
        originY,
        TRAY_NODE,
        Math.max(6, Math.floor(Math.max(layout.bounds.w, 1400) / (TRAY_NODE.w + 14)))
      )
      for (const tm of visible.unassigned) {
        const nid = therapistNodeId(tm.therapist.id)
        out.push({ id: nid, type: 'therapistTray', position: tray.get(nid)!, data: { model: tm } })
      }
    }
    return out
  }, [layout, savedPositions, visible, model, groupByBorough, showUnassigned])

  const edges = useMemo<Edge[]>(
    () =>
      visible.pairs.map((p) => ({
        id: edgeId(p.key),
        source: therapistNodeId(p.therapistId),
        target: clientNodeId(p.clientId),
        type: 'assignment',
        data: { pair: p, label: `${slotsLabel(p.slots)} · ${Math.round(p.hours * 10) / 10}h` },
        zIndex: p.conflictReasons.length ? 1 : 0,
      })),
    [visible.pairs]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes)
  useEffect(() => {
    setNodes(baseNodes)
  }, [baseNodes, setNodes])

  const filterSignature = `${periodKey}|${[...bands].join()}|${conflictsOnly}|${clientFilter}|${groupByBorough}|${showUnassigned}|${search}`
  useEffect(() => {
    const t = window.setTimeout(() => fitView({ padding: 0.12, duration: 250 }), 60)
    return () => window.clearTimeout(t)
  }, [filterSignature, fitView])

  // ── Interaction ─────────────────────────────────────────────────────
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [selection, setSelection] = useState<PanelSelection | null>(null)
  const [reassign, setReassign] = useState<ReassignRequest | null>(null)
  const dragStartRef = useRef<Point | null>(null)

  const highlighted = useMemo(() => {
    if (!hoverId) return null
    const set = new Set<string>([hoverId])
    if (hoverId.startsWith('e:')) {
      const p = model.pairs.get(hoverId.slice(2))
      if (p) {
        set.add(therapistNodeId(p.therapistId))
        set.add(clientNodeId(p.clientId))
      }
      return set
    }
    for (const p of visible.pairs) {
      const t = therapistNodeId(p.therapistId)
      const c = clientNodeId(p.clientId)
      if (t === hoverId || c === hoverId) {
        set.add(t)
        set.add(c)
        set.add(edgeId(p.key))
      }
    }
    return set
  }, [hoverId, visible.pairs, model])

  const selectedNodeId =
    selection?.kind === 'therapist'
      ? therapistNodeId(selection.id)
      : selection?.kind === 'client'
        ? clientNodeId(selection.id)
        : null

  const ui = useMemo<ConstellationUi>(
    () => ({
      highlighted,
      dropTargetId,
      selectedId: selectedNodeId,
      showEdgeLabels: visible.pairs.length <= 80,
      onAddSession: (therapistId) => onAddSlot({ therapistId }),
      onSelectPair: (key) => setSelection({ kind: 'pair', key }),
    }),
    [highlighted, dropTargetId, selectedNodeId, visible.pairs.length, onAddSlot]
  )

  const persistPosition = useCallback(
    (nodeId: string, p: Point) => {
      setSavedPositions((prev) => {
        const next = { ...prev, [nodeId]: { x: Math.round(p.x), y: Math.round(p.y) } }
        try {
          localStorage.setItem(positionsStorageKey(periodKey), JSON.stringify(next))
        } catch {
          // view preference only
        }
        return next
      })
    },
    [periodKey]
  )

  const therapistDropTarget = useCallback(
    (dragged: Node): string | null => {
      const hit = getIntersectingNodes(dragged).find((n) => n.type === 'therapist' || n.type === 'therapistTray')
      return hit?.id ?? null
    },
    [getIntersectingNodes]
  )

  const onNodeDragStart: NodeDragHandler = useCallback((_e, node) => {
    dragStartRef.current = { ...node.position }
    setHoverId(null)
  }, [])

  const onNodeDrag: NodeDragHandler = useCallback(
    (_e, node) => {
      if (node.type !== 'client') return
      const target = therapistDropTarget(node)
      setDropTargetId((prev) => (prev === target ? prev : target))
    },
    [therapistDropTarget]
  )

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_e, node) => {
      setDropTargetId(null)
      const start = dragStartRef.current
      dragStartRef.current = null
      if (node.type === 'client') {
        const targetNode = therapistDropTarget(node)
        const clientId = node.id.slice(2)
        const cm = model.clients.get(clientId)
        if (targetNode && cm) {
          const toTherapistId = targetNode.slice(2)
          const fromCandidates = cm.therapistIds.filter((id) => id !== toTherapistId)
          if (start) setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position: start } : n)))
          if (fromCandidates.length) setReassign({ clientId, fromCandidates, toTherapistId })
          return
        }
      }
      persistPosition(node.id, node.position)
    },
    [model, therapistDropTarget, setNodes, persistPosition]
  )

  const resetLayout = () => {
    try {
      localStorage.removeItem(positionsStorageKey(periodKey))
    } catch {
      // ignore
    }
    setSavedPositions({})
    for (const k of layoutCache.keys()) if (k.startsWith(`${periodKey}#`)) layoutCache.delete(k)
    lastLayoutRef.current = new Map()
    setBands(new Set(UTILIZATION_BANDS))
    window.setTimeout(() => fitView({ padding: 0.12, duration: 250 }), 60)
  }

  const handleSlotSaved = useCallback((slot: ScheduleSlot) => onSlotSaved(slot, false), [onSlotSaved])

  const moveTargets = useMemo(
    () =>
      [...model.therapists.values()]
        .filter((tm) => tm.therapist.active)
        .sort((a, b) => a.therapist.name.localeCompare(b.therapist.name))
        .map((tm) => ({ id: tm.therapist.id, name: `${tm.therapist.name} (${tm.hours.toFixed(1)}/${tm.target.hours})` })),
    [model]
  )

  const clientOptions = useMemo(
    () => [...model.clients.values()].sort((a, b) => a.client.name.localeCompare(b.client.name)),
    [model]
  )

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Utilization">
          {UTILIZATION_BANDS.map((b) => {
            const meta = BAND_META[b]
            const on = bands.has(b)
            return (
              <button
                key={b}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setBands((prev) => {
                    const next = new Set(prev)
                    if (next.has(b)) next.delete(b)
                    else next.add(b)
                    return next.size ? next : new Set(UTILIZATION_BANDS)
                  })
                }
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors',
                  on ? 'border-transparent' : 'border-line bg-surface text-quiet line-through decoration-1'
                )}
                style={on ? { background: meta.bg, color: meta.color } : undefined}
                title={meta.label}
              >
                <span aria-hidden>{meta.symbol}</span>
                {meta.short}
                <span className="tabular-nums opacity-80">{bandCounts[b]}</span>
              </button>
            )
          })}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-quiet">
          <input type="checkbox" checked={conflictsOnly} onChange={(e) => setConflictsOnly(e.target.checked)} className="rounded border-line" />
          Conflicts only
          {conflictPairCount > 0 && <span className="font-semibold text-[var(--urgent)]">({conflictPairCount})</span>}
        </label>

        <select
          aria-label="Filter by client"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-8 max-w-[14rem] rounded-lg border border-line bg-surface px-2 text-xs text-ink"
        >
          <option value="">All clients</option>
          {clientOptions.map((c) => (
            <option key={c.client.id} value={c.client.id}>
              {c.client.name}
              {c.client.code ? ` (${c.client.code})` : ''}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-quiet">
          <input type="checkbox" checked={groupByBorough} onChange={(e) => setGroupByBorough(e.target.checked)} className="rounded border-line" />
          Group by borough{borough ? ` (${borough})` : ''}
        </label>

        <label className="flex items-center gap-1.5 text-xs text-quiet">
          <input type="checkbox" checked={showUnassigned} onChange={(e) => setShowUnassigned(e.target.checked)} className="rounded border-line" />
          Show unassigned therapists ({visible.unassignedTotal})
        </label>

        <button
          type="button"
          onClick={resetLayout}
          className="ml-auto flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-quiet hover:bg-line-2 hover:text-ink"
          title="Clear dragged positions and recompute layout"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset layout
        </button>
      </div>

      <div className="relative h-[calc(100vh-290px)] min-h-[560px] overflow-hidden rounded-xl border border-line bg-[var(--bg)]">
        <div className="pointer-events-none absolute left-3 top-3 z-[5] rounded-lg bg-white/90 px-3 py-2 text-[11px] text-[var(--muted-ink)] shadow-sm ring-1 ring-[var(--line)]">
          <span className="font-semibold text-[var(--espresso)]">
            {visible.therapistIds.length} therapists · {visible.clientIds.length} clients · {visible.pairs.length} assignments
          </span>
          <span className="mx-2">|</span>
          <span className="inline-flex items-center gap-1">
            <svg width="22" height="6" aria-hidden>
              <line x1="0" y1="3" x2="22" y2="3" stroke="var(--urgent)" strokeWidth="2.4" strokeDasharray="6 4" />
            </svg>
            conflict
          </span>
          <span className="mx-2">·</span>
          drag a client onto a therapist to propose a move
        </div>

        {visible.therapistIds.length === 0 && !showUnassigned && (
          <div className="absolute inset-0 z-[4] flex items-center justify-center">
            <p className="rounded-lg bg-white px-4 py-3 text-sm text-[var(--muted-ink)] shadow-sm ring-1 ring-[var(--line)]">
              No therapists match these filters.
            </p>
          </div>
        )}

        <ConstellationUiContext.Provider value={ui}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesConnectable={false}
            edgesFocusable={false}
            minZoom={0.1}
            maxZoom={1.75}
            onlyRenderVisibleElements
            proOptions={{ hideAttribution: true }}
            onNodeMouseEnter={(_e, n) => {
              if (!dragStartRef.current && n.type !== 'groupLabel') setHoverId(n.id)
            }}
            onNodeMouseLeave={() => setHoverId(null)}
            onEdgeMouseEnter={(_e, ed) => setHoverId(ed.id)}
            onEdgeMouseLeave={() => setHoverId(null)}
            onNodeClick={(_e, n) => {
              if (n.type === 'therapist' || n.type === 'therapistTray') setSelection({ kind: 'therapist', id: n.id.slice(2) })
              else if (n.type === 'client') setSelection({ kind: 'client', id: n.id.slice(2) })
            }}
            onEdgeClick={(_e, ed) => setSelection({ kind: 'pair', key: ed.id.slice(2) })}
            onPaneClick={() => setSelection(null)}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
          >
            <Background gap={22} size={1.2} color="#e3dbd0" />
            <Controls showInteractive={false} className="!shadow-sm" />
            <MiniMap
              pannable
              zoomable
              className="!rounded-lg !border !border-[var(--line)]"
              nodeColor={(n) =>
                n.type === 'therapist' || n.type === 'therapistTray'
                  ? BAND_META[(n.data as { model: { band: UtilizationBand } }).model.band].color
                  : n.type === 'client'
                    ? '#d6cbbd'
                    : 'transparent'
              }
              maskColor="rgba(42,32,25,0.06)"
            />
          </ReactFlow>
        </ConstellationUiContext.Provider>

        {selection && (
          <ConstellationPanel
            selection={selection}
            model={model}
            canEditTarget={canEditTarget}
            moveTargets={moveTargets}
            allSlots={slots}
            conflicts={conflicts}
            onClose={() => setSelection(null)}
            onAddSession={(d) => onAddSlot(d)}
            onEditSlot={onEditSlot}
            onSlotSaved={handleSlotSaved}
            onSlotDeleted={onSlotDeleted}
            onTargetSaved={(row) => setTargets((prev) => new Map(prev).set(row.id, toTarget(row)))}
            onRequestMove={({ clientId, fromTherapistId, toTherapistId }) =>
              setReassign({ clientId, fromCandidates: [fromTherapistId], toTherapistId })
            }
          />
        )}
      </div>

      {reassign && (
        <ReassignDialog
          request={reassign}
          model={model}
          slots={slots}
          onCancel={() => setReassign(null)}
          onDone={({ moved, failed }) => {
            setReassign(null)
            if (failed.length) showToast(`Moved ${moved}; ${failed.length} failed — ${failed[0]}`, 'error')
            else showToast(`Moved ${moved} session${moved === 1 ? '' : 's'}`, 'success')
            void onRefresh()
          }}
        />
      )}
    </div>
  )
}

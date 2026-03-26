'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeDragHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'

import OrgChartNode from './OrgChartNode'
import OrgChartEdge from './OrgChartEdge'
import { buildFlowElements } from './buildFlowGraph'
import type { OrgNodeDTO } from './types'

const nodeTypes = { orgNode: OrgChartNode }
const edgeTypes = { orgChart: OrgChartEdge }

function isDescendantOf(rows: OrgNodeDTO[], ancestorId: string, descId: string): boolean {
  let cur: string | null = descId
  const byId = new Map(rows.map((r) => [r.id, r]))
  while (cur) {
    const parentId: string | null = byId.get(cur)?.parentId ?? null
    if (parentId === ancestorId) return true
    cur = parentId
  }
  return false
}

function depthFromRoot(rows: OrgNodeDTO[], id: string): number {
  let d = 0
  let cur: string | null = id
  const byId = new Map(rows.map((r) => [r.id, r]))
  while (cur) {
    const parentId: string | null = byId.get(cur)?.parentId ?? null
    if (!parentId) return d
    d += 1
    cur = parentId
  }
  return d
}

type InnerProps = {
  flatNodes: OrgNodeDTO[]
  editMode: boolean
  selectedNodeId: string | null
  searchQuery: string
  departmentFilter: string
  subDepartmentFilter: string
  onSelectNode: (id: string | null) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string) => void
  onReparent: (nodeId: string, newParentId: string | null) => Promise<void>
  captureRef: React.RefObject<HTMLDivElement | null>
  exportHandlerRef: React.MutableRefObject<(() => Promise<void>) | null>
}

function OrgChartCanvasInner({
  flatNodes,
  editMode,
  selectedNodeId,
  searchQuery,
  departmentFilter,
  subDepartmentFilter,
  onSelectNode,
  onEdit,
  onDelete,
  onAddChild,
  onReparent,
  captureRef,
  exportHandlerRef,
}: InnerProps) {
  const { getIntersectingNodes, fitView } = useReactFlow()
  const reparentingRef = useRef(false)

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () =>
      buildFlowElements(flatNodes, {
        editMode,
        selectedNodeId,
        searchQuery,
        departmentFilter,
        subDepartmentFilter,
        onEdit,
        onDelete,
        onAddChild,
      }),
    [
      flatNodes,
      editMode,
      selectedNodeId,
      searchQuery,
      departmentFilter,
      subDepartmentFilter,
      onEdit,
      onDelete,
      onAddChild,
    ]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)

  useEffect(() => {
    setNodes(layoutNodes)
    setEdges(layoutEdges)
  }, [layoutNodes, layoutEdges, setNodes, setEdges])

  useEffect(() => {
    if (flatNodes.length === 0) return
    const t = window.setTimeout(() => {
      fitView({ padding: 0.2, duration: 200 })
    }, 50)
    return () => window.clearTimeout(t)
  }, [flatNodes, fitView])

  const exportPng = useCallback(async () => {
    const el = captureRef.current
    if (!el) return
    await fitView({ padding: 0.2, duration: 200, maxZoom: 1.25 })
    await new Promise((r) => setTimeout(r, 350))
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
    const d = new Date()
    const name = `rise-shine-org-chart-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.png`
    const link = document.createElement('a')
    link.download = name
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [captureRef, fitView])

  useEffect(() => {
    exportHandlerRef.current = exportPng
    return () => {
      exportHandlerRef.current = null
    }
  }, [exportHandlerRef, exportPng])

  const onNodeDragStop: NodeDragHandler = useCallback(
    async (_event, dragged) => {
      if (!editMode || reparentingRef.current) return
      const intersecting = getIntersectingNodes(dragged)
      const candidates = intersecting
        .filter((n) => n.id !== dragged.id)
        .map((n) => ({ id: n.id, depth: depthFromRoot(flatNodes, n.id) }))
        .sort((a, b) => b.depth - a.depth)

      let newParentId: string | null | undefined
      for (const c of candidates) {
        if (isDescendantOf(flatNodes, dragged.id, c.id)) continue
        newParentId = c.id
        break
      }

      if (newParentId === undefined) {
        setNodes(layoutNodes)
        setEdges(layoutEdges)
        return
      }

      const currentParent = flatNodes.find((r) => r.id === dragged.id)?.parentId ?? null
      if (currentParent === newParentId) {
        setNodes(layoutNodes)
        setEdges(layoutEdges)
        return
      }

      const targetName = flatNodes.find((r) => r.id === newParentId)?.name ?? 'this person'
      const draggedName = flatNodes.find((r) => r.id === dragged.id)?.name ?? 'This person'
      if (
        !window.confirm(
          `Make ${draggedName} report to ${targetName}?`
        )
      ) {
        setNodes(layoutNodes)
        setEdges(layoutEdges)
        return
      }

      reparentingRef.current = true
      try {
        await onReparent(dragged.id, newParentId)
      } finally {
        reparentingRef.current = false
      }
    },
    [editMode, flatNodes, getIntersectingNodes, layoutEdges, layoutNodes, onReparent, setEdges, setNodes]
  )

  return (
    <div
      ref={captureRef as React.RefObject<HTMLDivElement>}
      className="h-[min(70vh,720px)] w-full rounded-xl border border-gray-200 bg-white dark:border-[var(--border-medium)] dark:bg-[var(--bg-elevated)]"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={editMode}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll
        minZoom={0.15}
        maxZoom={1.5}
        onNodeClick={(_, n) => onSelectNode(n.id)}
        onPaneClick={() => onSelectNode(null)}
        onNodeDragStop={onNodeDragStop}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#e5e7eb" className="dark:!bg-[var(--bg-primary)]" />
        <Controls className="!shadow-md dark:!bg-[var(--bg-elevated)]" />
        <MiniMap
          className="!rounded-lg !border !border-gray-200 dark:!border-[var(--border-medium)] dark:!bg-[var(--bg-elevated)]"
          nodeColor={() => '#f97316'}
          maskColor="rgba(0,0,0,0.08)"
        />
      </ReactFlow>
    </div>
  )
}

export type OrgChartCanvasProps = {
  flatNodes: OrgNodeDTO[]
  editMode: boolean
  selectedNodeId: string | null
  searchQuery: string
  departmentFilter: string
  subDepartmentFilter: string
  onSelectNode: (id: string | null) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string) => void
  onReparent: (nodeId: string, newParentId: string | null) => Promise<void>
  exportHandlerRef: React.MutableRefObject<(() => Promise<void>) | null>
}

export default function OrgChartCanvas(props: OrgChartCanvasProps) {
  const captureRef = useRef<HTMLDivElement | null>(null)
  return (
    <ReactFlowProvider>
      <OrgChartCanvasInner {...props} captureRef={captureRef} />
    </ReactFlowProvider>
  )
}

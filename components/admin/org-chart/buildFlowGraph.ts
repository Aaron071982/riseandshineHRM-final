import dagre from 'dagre'
import type { Edge, Node } from 'reactflow'
import { MarkerType, Position } from 'reactflow'
import { departmentMatchesFilter, subDepartmentMatchesFilter } from '@/lib/org-chart-departments'
import type { OrgChartNodeData, OrgNodeDTO } from './types'

const NODE_W = 260
const NODE_H = 168

export const ORG_NODE_DIMENSIONS = { w: NODE_W, h: NODE_H }

function matchesFilters(
  org: OrgNodeDTO,
  departmentFilter: string,
  subDepartmentFilter: string
): boolean {
  const deptOk = departmentMatchesFilter(org.department, departmentFilter)
  const subOk = subDepartmentMatchesFilter(org.subDepartment, departmentFilter, subDepartmentFilter)
  return deptOk && subOk
}

function matchesSearch(org: OrgNodeDTO, q: string): boolean {
  if (!q.trim()) return true
  const s = q.toLowerCase()
  return (
    org.name.toLowerCase().includes(s) ||
    org.title.toLowerCase().includes(s) ||
    (org.department?.toLowerCase().includes(s) ?? false) ||
    (org.subDepartment?.toLowerCase().includes(s) ?? false) ||
    (org.email?.toLowerCase().includes(s) ?? false)
  )
}

export function buildFlowElements(
  rows: OrgNodeDTO[],
  opts: {
    editMode: boolean
    selectedNodeId: string | null
    searchQuery: string
    departmentFilter: string
    subDepartmentFilter: string
    onEdit: (id: string) => void
    onDelete: (id: string) => void
    onAddChild: (parentId: string) => void
  }
): { nodes: Node<OrgChartNodeData>[]; edges: Edge[] } {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const childrenCount = new Map<string, number>()
  for (const r of rows) {
    if (r.parentId) {
      childrenCount.set(r.parentId, (childrenCount.get(r.parentId) ?? 0) + 1)
    }
  }

  const roots = rows.filter((r) => r.parentId === null)
  const primaryRootId = roots.length === 1 ? roots[0].id : roots.sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id ?? null

  const q = opts.searchQuery.trim()
  const deptF = opts.departmentFilter
  const subF = opts.subDepartmentFilter

  const nodes: Node<OrgChartNodeData>[] = rows.map((org) => {
    const searchOk = matchesSearch(org, q)
    const filterOk = matchesFilters(org, deptF, subF)
    const highlighted = searchOk && filterOk
    const dimmed = !highlighted && (q.length > 0 || deptF !== 'All' || subF !== 'All')

    return {
      id: org.id,
      type: 'orgNode',
      position: { x: 0, y: 0 },
      data: {
        org,
        isRoot: org.parentId === null && org.id === primaryRootId,
        editMode: opts.editMode,
        dimmed,
        highlighted,
        selected: opts.selectedNodeId === org.id,
        directReportsCount: childrenCount.get(org.id) ?? 0,
        onEdit: opts.onEdit,
        onDelete: opts.onDelete,
        onAddChild: opts.onAddChild,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }
  })

  const edges: Edge[] = rows
    .filter((r) => r.parentId)
    .map((r) => ({
      id: `e-${r.parentId}-${r.id}`,
      source: r.parentId!,
      target: r.id,
      type: 'orgChart',
      animated: false,
      style: { stroke: '#f97316', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316', width: 16, height: 16 },
      data: { editMode: opts.editMode },
    }))

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    align: 'UL',
    nodesep: 48,
    ranksep: 72,
    marginx: 24,
    marginy: 24,
  })

  nodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_W, height: NODE_H })
  })
  edges.forEach((e) => {
    g.setEdge(e.source, e.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id)
    if (!pos) {
      return { ...node, position: { x: 0, y: 0 } }
    }
    return {
      ...node,
      position: {
        x: pos.x - NODE_W / 2,
        y: pos.y - NODE_H / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

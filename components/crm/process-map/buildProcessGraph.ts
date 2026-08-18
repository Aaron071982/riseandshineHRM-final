import type { Edge, Node } from 'reactflow'
import { MarkerType } from 'reactflow'
import type {
  ProcessMapData,
  ProcessDepartment,
  ProcessPerson,
  ProcessStage,
} from '@/lib/crm/processMapModel'

export const DEPT_NODE_W = 320
const COL_GAP = 170
const DEPT_ROW_Y = 0
const LEADERSHIP_W = 460
const LEADERSHIP_Y = -280
const TRACK_Y = 780

export type DeptNodeData = {
  department: ProcessDepartment
  step: number
}

export type LeadershipNodeData = {
  people: ProcessPerson[]
}

export type TrackNodeData = {
  track: ProcessStage & { ownerDept: string }
  ownerLabel: string
}

export type ProcessGraph = {
  nodes: Node[]
  edges: Edge[]
}

function deptX(index: number): number {
  return index * (DEPT_NODE_W + COL_GAP)
}

function edgeLabel(labels: string[]): string {
  const [first, ...rest] = labels
  if (!first) return ''
  return rest.length > 0 ? `${first} (+${rest.length})` : first
}

export function buildProcessGraph(data: ProcessMapData): ProcessGraph {
  const indexOfDept = new Map(
    data.departments.map((d, i) => [d.dept, i] as const)
  )
  const rowWidth =
    data.departments.length * DEPT_NODE_W +
    Math.max(0, data.departments.length - 1) * COL_GAP

  const nodes: Node[] = data.departments.map((department, index) => ({
    id: `dept-${department.dept}`,
    type: 'processDept',
    position: { x: deptX(index), y: DEPT_ROW_Y },
    data: { department, step: index + 1 } satisfies DeptNodeData,
    draggable: false,
    selectable: false,
  }))

  nodes.push({
    id: 'leadership',
    type: 'processLeadership',
    position: { x: (rowWidth - LEADERSHIP_W) / 2, y: LEADERSHIP_Y },
    data: { people: data.leadership } satisfies LeadershipNodeData,
    draggable: false,
    selectable: false,
  })

  const clinicalIndex = indexOfDept.get('CLINICAL') ?? 1
  nodes.push({
    id: 'parallel-track',
    type: 'processTrack',
    position: { x: deptX(clinicalIndex), y: TRACK_Y },
    data: {
      track: data.parallelTrack,
      ownerLabel:
        data.departments.find((d) => d.dept === data.parallelTrack.ownerDept)
          ?.label ?? 'Clinical',
    } satisfies TrackNodeData,
    draggable: false,
    selectable: false,
  })

  const edges: Edge[] = []
  let detourCount = 0

  for (const handoff of data.handoffs) {
    const from = indexOfDept.get(handoff.from)
    const to = indexOfDept.get(handoff.to)
    if (from === undefined || to === undefined) continue

    const accent =
      data.departments[from]?.accent.fg ?? 'var(--brand)'
    const isNextStep = handoff.kind === 'forward' && to - from === 1

    if (isNextStep) {
      edges.push({
        id: handoff.id,
        source: `dept-${handoff.from}`,
        sourceHandle: 'out',
        target: `dept-${handoff.to}`,
        targetHandle: 'in',
        type: 'smoothstep',
        label: edgeLabel(handoff.labels),
        labelShowBg: true,
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 6,
        labelBgStyle: { fill: 'var(--surface)', opacity: 0.95 },
        labelStyle: { fill: 'var(--muted-ink)', fontSize: 11 },
        style: { stroke: accent, strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: accent,
          width: 16,
          height: 16,
        },
      })
      continue
    }

    detourCount += 1
    edges.push({
      id: handoff.id,
      source: `dept-${handoff.from}`,
      sourceHandle: 'down',
      target: `dept-${handoff.to}`,
      targetHandle: 'up',
      type: 'smoothstep',
      pathOptions: { borderRadius: 18, offset: 70 * detourCount },
      label: edgeLabel(handoff.labels),
      labelShowBg: true,
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 6,
      labelBgStyle: { fill: 'var(--surface)', opacity: 0.95 },
      labelStyle: { fill: 'var(--muted-ink)', fontSize: 11 },
      style: {
        stroke: 'var(--faint)',
        strokeWidth: 1.5,
        strokeDasharray: '6 6',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--faint)',
        width: 14,
        height: 14,
      },
    })
  }

  for (const department of data.departments) {
    edges.push({
      id: `oversight-${department.dept}`,
      source: 'leadership',
      sourceHandle: 'oversight',
      target: `dept-${department.dept}`,
      targetHandle: 'top',
      type: 'smoothstep',
      style: {
        stroke: 'var(--line)',
        strokeWidth: 1,
        strokeDasharray: '2 6',
      },
    })
  }

  edges.push({
    id: 'parallel-track-edge',
    source: `dept-${data.parallelTrack.ownerDept}`,
    sourceHandle: 'down',
    target: 'parallel-track',
    targetHandle: 'top',
    type: 'smoothstep',
    label: 'runs in parallel',
    labelShowBg: true,
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 6,
    labelBgStyle: { fill: 'var(--surface)', opacity: 0.95 },
    labelStyle: { fill: 'var(--muted-ink)', fontSize: 11 },
    style: {
      stroke: 'var(--stage-clinical)',
      strokeWidth: 1.5,
      strokeDasharray: '6 6',
    },
  })

  return { nodes, edges }
}

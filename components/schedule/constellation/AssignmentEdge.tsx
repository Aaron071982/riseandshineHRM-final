'use client'

import { memo, useCallback } from 'react'
import { EdgeLabelRenderer, useStore, type EdgeProps, type Node, type ReactFlowState } from 'reactflow'
import { fmtH } from '@/lib/schedule/utils'
import type { PairModel } from '@/lib/schedule/constellation'
import { useConstellationUi } from './context'

export type AssignmentEdgeData = { pair: PairModel; label: string }

function centre(n: Node) {
  const p = n.positionAbsolute ?? n.position
  return { x: p.x + (n.width ?? 0) / 2, y: p.y + (n.height ?? 0) / 2, hw: (n.width ?? 0) / 2, hh: (n.height ?? 0) / 2 }
}

/** Point where the line between two node centres leaves `from`'s bounding box. */
function borderPoint(from: ReturnType<typeof centre>, to: ReturnType<typeof centre>) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return { x: from.x, y: from.y }
  const scale = Math.min(dx !== 0 ? from.hw / Math.abs(dx) : Infinity, dy !== 0 ? from.hh / Math.abs(dy) : Infinity)
  return { x: from.x + dx * scale, y: from.y + dy * scale }
}

const zoomSelector = (s: ReactFlowState) => s.transform[2]

function AssignmentEdge({ id, source, target, data }: EdgeProps<AssignmentEdgeData>) {
  const ui = useConstellationUi()
  const sourceNode = useStore(useCallback((s: ReactFlowState) => s.nodeInternals.get(source), [source]))
  const targetNode = useStore(useCallback((s: ReactFlowState) => s.nodeInternals.get(target), [target]))
  const zoom = useStore(zoomSelector)
  if (!sourceNode || !targetNode || !data) return null

  const a = centre(sourceNode)
  const b = centre(targetNode)
  const p1 = borderPoint(a, b)
  const p2 = borderPoint(b, a)
  const path = `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`

  const conflict = data.pair.conflictReasons.length > 0
  const highlighted = ui.highlighted?.has(id) ?? false
  const dimmed = ui.highlighted != null && !highlighted
  const stroke = conflict ? 'var(--urgent)' : highlighted ? 'var(--brand)' : 'rgba(42,32,25,0.38)'
  const tooltip = conflict
    ? `Conflict: ${data.pair.conflictReasons.join('; ')}\n${data.label}`
    : `${data.label} · ${fmtH(data.pair.hours)} hrs/wk`
  const showLabel = !dimmed && (highlighted || conflict || (ui.showEdgeLabels && zoom >= 0.7))

  return (
    <>
      <g style={{ opacity: dimmed ? 0.1 : 1, transition: 'opacity 120ms' }}>
        <title>{tooltip}</title>
        <path d={path} fill="none" stroke="transparent" strokeWidth={14} className="react-flow__edge-interaction" />
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={conflict || highlighted ? 2.4 : 1.4}
          strokeDasharray={conflict ? '6 4' : undefined}
          className="react-flow__edge-path"
        />
      </g>
      {showLabel && (
        <EdgeLabelRenderer>
          <button
            type="button"
            title={tooltip}
            onClick={() => ui.onSelectPair(data.pair.key)}
            className="nodrag nopan absolute max-w-[220px] truncate rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${(p1.x + p2.x) / 2}px, ${(p1.y + p2.y) / 2}px)`,
              pointerEvents: 'all',
              background: conflict ? 'var(--urgent-bg)' : '#FFFDF9',
              borderColor: conflict ? 'var(--urgent)' : 'var(--line)',
              color: conflict ? 'var(--urgent)' : 'var(--espresso)',
            }}
          >
            {conflict && <span aria-hidden>⚠ </span>}
            {data.label}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(AssignmentEdge)

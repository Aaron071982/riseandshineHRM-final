'use client'

import { EdgeProps, getBezierPath } from 'reactflow'
import type { OrgChartEdgeData } from './types'

export default function OrgChartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<OrgChartEdgeData>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const editMode = data?.editMode ?? false

  return (
    <path
      id={id}
      d={path}
      fill="none"
      markerEnd={markerEnd}
      className={editMode ? 'org-chart-edge-stroke' : 'org-chart-edge-stroke org-chart-edge-animated'}
    />
  )
}

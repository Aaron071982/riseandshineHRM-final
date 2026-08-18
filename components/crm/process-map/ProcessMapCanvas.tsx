'use client'

import { useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { ProcessMapData } from '@/lib/crm/processMapModel'
import { buildProcessGraph } from './buildProcessGraph'
import {
  ProcessDeptNode,
  ProcessLeadershipNode,
  ProcessTrackNode,
} from './ProcessMapNodes'

const nodeTypes = {
  processDept: ProcessDeptNode,
  processLeadership: ProcessLeadershipNode,
  processTrack: ProcessTrackNode,
}

function ProcessMapCanvasInner({ data }: { data: ProcessMapData }) {
  const graph = useMemo(() => buildProcessGraph(data), [data])
  const [nodes, setNodes] = useNodesState(graph.nodes)
  const [edges, setEdges] = useEdgesState(graph.edges)
  const { fitView } = useReactFlow()

  useEffect(() => {
    setNodes(graph.nodes)
    setEdges(graph.edges)
  }, [graph, setNodes, setEdges])

  useEffect(() => {
    const t = window.setTimeout(() => {
      fitView({ padding: 0.12, duration: 200 })
    }, 60)
    return () => window.clearTimeout(t)
  }, [graph, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnScroll
      minZoom={0.1}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} size={1} color="var(--line)" />
      <Controls showInteractive={false} className="!shadow-sm" />
      <MiniMap
        pannable
        className="!rounded-lg !border !border-line"
        nodeColor={() => 'var(--faint)'}
        maskColor="rgba(0,0,0,0.06)"
      />
    </ReactFlow>
  )
}

export default function ProcessMapCanvas({ data }: { data: ProcessMapData }) {
  return (
    <div className="h-[min(76vh,860px)] w-full overflow-hidden rounded-card border border-line bg-surface">
      <ReactFlowProvider>
        <ProcessMapCanvasInner data={data} />
      </ReactFlowProvider>
    </div>
  )
}

'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { AlertTriangle, Plus, Users } from 'lucide-react'
import { fmtH } from '@/lib/schedule/utils'
import { BAND_META, type ClientModel, type TherapistModel } from '@/lib/schedule/constellation'
import { cn } from '@/lib/utils'
import CapacityMeter, { formatReading } from './CapacityMeter'
import { CLIENT_NODE, THERAPIST_NODE, TRAY_NODE, useConstellationUi } from './context'

const hiddenHandle = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0, left: '50%', top: '50%' }

function useNodeState(id: string) {
  const ui = useConstellationUi()
  return {
    ui,
    dimmed: ui.highlighted != null && !ui.highlighted.has(id),
    isDropTarget: ui.dropTargetId === id,
    isSelected: ui.selectedId === id,
  }
}

export type TherapistNodeData = { model: TherapistModel }

export const TherapistNode = memo(function TherapistNode({ id, data }: NodeProps<TherapistNodeData>) {
  const { ui, dimmed, isDropTarget, isSelected } = useNodeState(id)
  const { model } = data
  const meta = BAND_META[model.band]
  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-xl border bg-white px-3 pb-2.5 pt-2 shadow-[0_1px_2px_rgba(42,32,25,0.08)] transition-[opacity,box-shadow]',
        dimmed && 'opacity-25',
        isSelected && 'ring-2 ring-[var(--brand)]',
        isDropTarget && 'ring-4 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--bg)]'
      )}
      style={{ width: THERAPIST_NODE.w, minHeight: THERAPIST_NODE.h, borderColor: 'var(--line)', borderLeft: `4px solid ${meta.color}` }}
    >
      <Handle type="source" position={Position.Right} style={hiddenHandle} isConnectable={false} />
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate font-display text-[13.5px] font-semibold text-[var(--espresso)]" title={model.therapist.name}>
          {model.therapist.name}
        </span>
        {model.conflictCount > 0 && (
          <span
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--urgent-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--urgent)]"
            title={`${model.conflictCount} conflicting session${model.conflictCount === 1 ? '' : 's'}`}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {model.conflictCount}
          </span>
        )}
        <button
          type="button"
          className="nodrag flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-ink)] hover:bg-[var(--sunrise-soft)] hover:text-[var(--brand)]"
          title={`Add session for ${model.therapist.name}`}
          aria-label={`Add session for ${model.therapist.name}`}
          onClick={(e) => {
            e.stopPropagation()
            ui.onAddSession(model.therapist.id)
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <CapacityMeter hours={model.hours} target={model.target.hours} />
      <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-[var(--muted-ink)]">
        <span>
          {model.pairKeys.length} client{model.pairKeys.length === 1 ? '' : 's'}
        </span>
        <span style={{ color: meta.color }} className="font-medium">
          {meta.short}
        </span>
      </div>
    </div>
  )
})

export const TherapistTrayNode = memo(function TherapistTrayNode({ id, data }: NodeProps<TherapistNodeData>) {
  const { dimmed, isDropTarget, isSelected } = useNodeState(id)
  const { model } = data
  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border border-dashed border-[var(--line)] bg-white/90 px-2.5 py-1.5 transition-opacity',
        dimmed && 'opacity-25',
        isSelected && 'ring-2 ring-[var(--brand)]',
        isDropTarget && 'ring-4 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--bg)]'
      )}
      style={{ width: TRAY_NODE.w, minHeight: TRAY_NODE.h }}
      title={`${model.therapist.name} — ${formatReading(model.hours, model.target.hours)}`}
    >
      <Handle type="source" position={Position.Right} style={hiddenHandle} isConnectable={false} />
      <div className="mb-1 truncate text-[12px] font-medium text-[var(--espresso)]">{model.therapist.name}</div>
      <CapacityMeter hours={model.hours} target={model.target.hours} size="sm" showLabel={false} />
      <div className="mt-0.5 text-[10px] tabular-nums text-[var(--muted-ink)]">{formatReading(model.hours, model.target.hours)}</div>
    </div>
  )
})

export type ClientNodeData = { model: ClientModel }

export const ClientNode = memo(function ClientNode({ id, data }: NodeProps<ClientNodeData>) {
  const { dimmed, isSelected } = useNodeState(id)
  const { client, hours, therapistIds, conflictCount } = data.model
  const auth = client.authorizedHoursPerWeek
  return (
    <div
      className={cn(
        'cursor-grab rounded-lg border bg-[#FBF8F3] px-2.5 py-1.5 shadow-[0_1px_2px_rgba(42,32,25,0.06)] transition-opacity active:cursor-grabbing',
        dimmed && 'opacity-25',
        isSelected && 'ring-2 ring-[var(--brand)]',
        conflictCount > 0 ? 'border-[var(--urgent)]' : 'border-[var(--line)]'
      )}
      style={{ width: CLIENT_NODE.w, minHeight: CLIENT_NODE.h }}
    >
      <Handle type="target" position={Position.Left} style={hiddenHandle} isConnectable={false} />
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--ink)]" title={client.name}>
          {client.name}
        </span>
        {client.code && (
          <span className="shrink-0 rounded bg-white px-1 text-[10px] font-medium text-[var(--muted-ink)] ring-1 ring-[var(--line)]">
            {client.code}
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] tabular-nums text-[var(--muted-ink)]">
        <span className="font-semibold text-[var(--espresso)]">{fmtH(hours)} hrs/wk</span>
        {auth != null && <span>/ {fmtH(auth)} auth</span>}
        {therapistIds.length > 1 && (
          <span className="ml-auto flex items-center gap-0.5" title={`Shared by ${therapistIds.length} therapists`}>
            <Users className="h-3 w-3" aria-hidden />
            {therapistIds.length}
          </span>
        )}
      </div>
    </div>
  )
})

export type GroupLabelData = { label: string; sub?: string }

export const GroupLabelNode = memo(function GroupLabelNode({ data }: NodeProps<GroupLabelData>) {
  return (
    <div className="pointer-events-none select-none whitespace-nowrap">
      <span className="font-display text-[15px] font-semibold text-[var(--espresso)]">{data.label}</span>
      {data.sub && <span className="ml-2 text-[12px] text-[var(--muted-ink)]">{data.sub}</span>}
    </div>
  )
})

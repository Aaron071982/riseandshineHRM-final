'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Mail, Pencil, Plus, Trash2, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { departmentBorderColor, normalizeDepartmentForDisplay } from '@/lib/org-chart-departments'
import type { OrgChartNodeData } from './types'

function initial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

function OrgChartNodeInner({ data }: NodeProps<OrgChartNodeData>) {
  const {
    org,
    isRoot,
    editMode,
    dimmed,
    highlighted,
    selected,
    onEdit,
    onDelete,
    onAddChild,
  } = data

  const borderColor = departmentBorderColor(org.department)
  const deptLabel = normalizeDepartmentForDisplay(org.department) ?? org.department
  const dimClass = dimmed ? 'opacity-20' : highlighted ? 'opacity-100' : 'opacity-100'

  return (
    <div
      className={cn(
        'relative rounded-xl shadow-md transition-all duration-200 w-[260px]',
        dimClass,
        selected && 'ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-[var(--bg-primary)] shadow-lg',
        !editMode && 'hover:shadow-xl hover:-translate-y-0.5',
        isRoot
          ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 text-white border-0'
          : 'bg-white dark:bg-[var(--bg-elevated)] border border-gray-100 dark:border-[var(--border-subtle)]'
      )}
      style={
        !isRoot
          ? { borderLeftWidth: 4, borderLeftColor: borderColor }
          : undefined
      }
    >
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-2 !h-2" />
      <div className={cn('p-3', isRoot && 'text-white')}>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-inner',
              isRoot && 'ring-2 ring-white/30'
            )}
            style={{ backgroundColor: isRoot ? 'rgba(255,255,255,0.25)' : org.avatarColor || borderColor }}
          >
            {isRoot ? <Crown className="h-7 w-7 text-white" /> : initial(org.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1">
              <p className={cn('font-bold leading-tight truncate', isRoot ? 'text-white' : 'text-gray-900 dark:text-[var(--text-primary)]')}>
                {org.name}
              </p>
              {editMode && (
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label="Edit"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(org.id)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-red-500/20 text-red-600"
                    aria-label="Delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(org.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <p className={cn('text-sm font-medium truncate', isRoot ? 'text-white/90' : 'text-gray-600 dark:text-[var(--text-tertiary)]')}>
              {org.title}
            </p>
            {deptLabel ? (
              <span
                className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: `${borderColor}22`,
                  color: isRoot ? 'white' : borderColor,
                }}
              >
                {deptLabel}
              </span>
            ) : null}
            {org.subDepartment?.trim() ? (
              <span
                className={cn(
                  'mt-0.5 inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium',
                  isRoot ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-[var(--text-secondary)]'
                )}
                title={org.subDepartment}
              >
                {org.subDepartment}
              </span>
            ) : null}
            {org.email && (
              <p className={cn('mt-2 flex items-center gap-1 text-xs truncate', isRoot ? 'text-white/90' : 'text-gray-500 dark:text-[var(--text-tertiary)]')}>
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{org.email}</span>
              </p>
            )}
          </div>
        </div>
        {editMode && (
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-orange-400/60 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 dark:hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation()
              onAddChild(org.id)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add child
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-2 !h-2" />
    </div>
  )
}

export default memo(OrgChartNodeInner)

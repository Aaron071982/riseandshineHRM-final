'use client'

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  departmentBorderColor,
  departmentMatchesFilter,
  normalizeDepartmentForDisplay,
  subDepartmentMatchesFilter,
} from '@/lib/org-chart-departments'
import type { OrgNodeDTO } from './types'

function buildChildrenMap(nodes: OrgNodeDTO[]) {
  const map = new Map<string | null, OrgNodeDTO[]>()
  for (const n of nodes) {
    const key = n.parentId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(n)
  }
  for (const [, arr] of map) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  }
  return map
}

function TreeBranch({
  node,
  childrenMap,
  depth,
  onSelect,
  departmentFilter,
  subDepartmentFilter,
  search,
}: {
  node: OrgNodeDTO
  childrenMap: Map<string | null, OrgNodeDTO[]>
  depth: number
  onSelect: (id: string) => void
  departmentFilter: string
  subDepartmentFilter: string
  search: string
}) {
  const kids = childrenMap.get(node.id) || []
  const border = departmentBorderColor(node.department)
  const deptLabel = normalizeDepartmentForDisplay(node.department) ?? node.department
  const q = search.trim().toLowerCase()
  const matchesSearch =
    !q ||
    node.name.toLowerCase().includes(q) ||
    node.title.toLowerCase().includes(q) ||
    (node.email || '').toLowerCase().includes(q) ||
    (node.subDepartment || '').toLowerCase().includes(q)
  const matchesFilters =
    departmentMatchesFilter(node.department, departmentFilter) &&
    subDepartmentMatchesFilter(node.subDepartment, departmentFilter, subDepartmentFilter)
  const dim = !matchesSearch || !matchesFilters

  return (
    <div className={dim ? 'opacity-40' : ''}>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className="flex w-full items-start gap-2 rounded-lg border border-gray-100 bg-white p-3 text-left shadow-sm dark:border-[var(--border-medium)] dark:bg-[var(--bg-elevated)]"
        style={{ marginLeft: depth * 12, borderLeftWidth: 4, borderLeftColor: border }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">{node.name}</span>
          <span className="text-sm text-gray-600 dark:text-[var(--text-secondary)]">{node.title}</span>
          {deptLabel ? (
            <span
              className="mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: border }}
            >
              {deptLabel}
            </span>
          ) : null}
          {node.subDepartment?.trim() ? (
            <span className="text-xs text-gray-500 dark:text-[var(--text-tertiary)]">{node.subDepartment}</span>
          ) : null}
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-400" />
      </button>
      {kids.length > 0 ? (
        <div className="mt-2 space-y-2 border-l border-dashed border-gray-200 pl-3 dark:border-[var(--border-medium)]">
          {kids.map((c) => (
            <TreeBranch
              key={c.id}
              node={c}
              childrenMap={childrenMap}
              depth={depth + 1}
              onSelect={onSelect}
              departmentFilter={departmentFilter}
              subDepartmentFilter={subDepartmentFilter}
              search={search}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

type Props = {
  nodes: OrgNodeDTO[]
  departmentFilter: string
  subDepartmentFilter: string
  search: string
  onSelectNode: (id: string) => void
}

export default function OrgChartMobileTree({
  nodes,
  departmentFilter,
  subDepartmentFilter,
  search,
  onSelectNode,
}: Props) {
  const childrenMap = useMemo(() => buildChildrenMap(nodes), [nodes])
  const roots = useMemo(() => childrenMap.get(null) || [], [childrenMap])

  if (roots.length === 0) {
    return (
      <p className="text-center text-sm text-gray-500 dark:text-[var(--text-tertiary)]">
        No hierarchy yet. Add people on desktop or use Edit mode.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {roots.map((r) => (
        <TreeBranch
          key={r.id}
          node={r}
          childrenMap={childrenMap}
          depth={0}
          onSelect={onSelectNode}
          departmentFilter={departmentFilter}
          subDepartmentFilter={subDepartmentFilter}
          search={search}
        />
      ))}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { X, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { departmentBorderColor, normalizeDepartmentForDisplay } from '@/lib/org-chart-departments'
import type { OrgNodeDTO } from './types'

function initial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]!.toUpperCase()
}

type Props = {
  node: OrgNodeDTO | null
  rows: OrgNodeDTO[]
  open: boolean
  onClose: () => void
  onSelectNode: (id: string) => void
}

export default function OrgNodeDetailPanel({ node, rows, open, onClose, onSelectNode }: Props) {
  if (!node) return null

  const byId = new Map(rows.map((r) => [r.id, r]))
  const manager = node.parentId ? byId.get(node.parentId) : null
  const directReports = rows.filter((r) => r.parentId === node.id)

  const borderColor = departmentBorderColor(node.department)
  const deptLabel = normalizeDepartmentForDisplay(node.department) ?? node.department
  const linked = node.linkedUser
  const rbtId = linked?.rbtProfile?.id
  const systemHref = rbtId ? `/admin/rbts/${rbtId}` : '/admin/employees'

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 dark:border-[var(--border-subtle)] dark:bg-[var(--bg-elevated)] md:max-w-sm',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-[var(--border-subtle)]">
          <span className="text-sm font-semibold text-gray-500 dark:text-[var(--text-tertiary)]">Profile</span>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col items-center text-center">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white shadow-lg"
              style={{ backgroundColor: node.avatarColor || borderColor }}
            >
              {initial(node.name)}
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">{node.name}</h2>
            <p className="text-sm font-medium text-gray-600 dark:text-[var(--text-tertiary)]">{node.title}</p>
            {deptLabel && (
              <span
                className="mt-2 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: `${borderColor}22`, color: borderColor }}
              >
                {deptLabel}
              </span>
            )}
            {node.subDepartment?.trim() ? (
              <p className="mt-2 text-sm text-gray-600 dark:text-[var(--text-secondary)]">
                <span className="font-medium text-gray-500 dark:text-[var(--text-tertiary)]">Subgroup: </span>
                {node.subDepartment}
              </p>
            ) : null}
          </div>

          <div className="mt-8 space-y-4 text-sm">
            {node.email && (
              <a
                href={`mailto:${node.email}`}
                className="flex items-center gap-2 text-orange-600 hover:underline dark:text-[var(--orange-primary)]"
              >
                <Mail className="h-4 w-4 shrink-0" />
                {node.email}
              </a>
            )}
            {node.phone && (
              <a href={`tel:${node.phone}`} className="flex items-center gap-2 text-orange-600 hover:underline dark:text-[var(--orange-primary)]">
                <Phone className="h-4 w-4 shrink-0" />
                {node.phone}
              </a>
            )}
            <div className="border-t border-gray-100 pt-4 dark:border-[var(--border-subtle)]">
              <p className="text-xs font-medium uppercase text-gray-500 dark:text-[var(--text-tertiary)]">Reports to</p>
              {manager ? (
                <button
                  type="button"
                  className="mt-1 text-left font-medium text-gray-900 hover:text-orange-600 dark:text-[var(--text-primary)] dark:hover:text-[var(--orange-primary)]"
                  onClick={() => onSelectNode(manager.id)}
                >
                  {manager.name}
                </button>
              ) : (
                <p className="mt-1 text-gray-600 dark:text-[var(--text-tertiary)]">—</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-500 dark:text-[var(--text-tertiary)]">Direct reports</p>
              <p className="mt-1 font-medium text-gray-900 dark:text-[var(--text-primary)]">{directReports.length} people</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {directReports.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white transition hover:ring-2 hover:ring-orange-400"
                    style={{ backgroundColor: r.avatarColor || departmentBorderColor(r.department) }}
                    title={r.name}
                    onClick={() => onSelectNode(r.id)}
                  >
                    {initial(r.name)}
                  </button>
                ))}
              </div>
            </div>
            {linked && (
              <div className="pt-2">
                <Link
                  href={systemHref}
                  className="inline-flex text-sm font-semibold text-orange-600 hover:underline dark:text-[var(--orange-primary)]"
                >
                  View in system →
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

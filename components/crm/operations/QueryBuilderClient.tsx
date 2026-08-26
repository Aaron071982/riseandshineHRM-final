'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { CrmRole, SavedQueryShareScope } from '@prisma/client'
import {
  deleteSavedQuery,
  exportOperationsQueryCsv,
  listSavedQueries,
  loadSavedQuery,
  runOperationsQuery,
  saveOperationsQuery,
} from '@/lib/operations/actions'
import { QUERY_FILTER_FIELDS } from '@/lib/operations/queryBuilder'
import {
  ReportShell,
  ReportTable,
  downloadCsv,
} from '@/components/crm/operations/ReportShell'

type Clause = {
  field: string
  op: string
  value: string
}

const FIELD_OPS: Record<string, string[]> = {
  stage: ['eq', 'in', 'neq'],
  pipelineStatus: ['eq', 'in'],
  currentOwnerDept: ['eq', 'in'],
  caseCoordinatorUserId: ['eq'],
  bcbaProfileId: ['eq'],
  payerType: ['eq'],
  hasRbtAssignment: ['true', 'false'],
  hasMissingRequirement: ['true', 'false'],
  authType: ['eq'],
  authStatus: ['eq'],
  authBand: ['eq'],
  city: ['eq'],
  borough: ['eq'],
  preferredRbtGender: ['eq'],
  stageAgeDaysMin: ['gte'],
  createdAtFrom: ['gte'],
  createdAtTo: ['lte'],
  language: ['eq'],
}

export function QueryBuilderClient() {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [groupOp, setGroupOp] = useState<'AND' | 'OR'>('AND')
  const [clauses, setClauses] = useState<Clause[]>([
    { field: 'stage', op: 'eq', value: 'ASSESSMENT' },
  ])
  const [columns, setColumns] = useState<string[]>([
    'client',
    'clientCode',
    'stage',
    'dept',
    'caseCoordinator',
    'borough',
    'hasRbt',
  ])
  const [result, setResult] = useState<{
    columns: { key: string; header: string }[]
    rows: Record<string, string | number | null>[]
    count: number
  } | null>(null)
  const [saved, setSaved] = useState<
    {
      id: string
      name: string
      description: string | null
      shareScope: SavedQueryShareScope
      sharedWithRole: CrmRole | null
      isOwner: boolean
    }[]
  >([])
  const [saveName, setSaveName] = useState('')
  const [shareScope, setShareScope] = useState<SavedQueryShareScope>('PRIVATE')
  const [sharedRole, setSharedRole] = useState<CrmRole>('CASE_COORDINATION')

  const refreshSaved = useCallback(() => {
    start(async () => {
      const res = await listSavedQueries()
      if (res.ok) setSaved(res.queries)
    })
  }, [])

  useEffect(() => {
    refreshSaved()
  }, [refreshSaved])

  const buildFilter = () => ({
    op: groupOp,
    clauses: clauses.map((c) => {
      if (c.op === 'true' || c.op === 'false') {
        return { field: c.field, op: c.op }
      }
      if (c.op === 'in') {
        return {
          field: c.field,
          op: 'in',
          value: c.value.split(',').map((s) => s.trim()).filter(Boolean),
        }
      }
      if (c.field === 'stageAgeDaysMin') {
        return { field: c.field, op: 'gte', value: Number(c.value) }
      }
      if (c.field === 'createdAtFrom' || c.field === 'createdAtTo') {
        return {
          field: c.field,
          op: c.field === 'createdAtFrom' ? 'gte' : 'lte',
          value: c.value,
        }
      }
      if (c.field === 'caseCoordinatorUserId' && c.value.trim() === '') {
        return { field: c.field, op: 'eq', value: null }
      }
      return { field: c.field, op: c.op, value: c.value }
    }),
  })

  const run = () => {
    start(async () => {
      setError('')
      const res = await runOperationsQuery({
        filter: buildFilter(),
        columns,
      })
      if (!res.ok) {
        setError(res.error)
        setResult(null)
        return
      }
      setResult({ columns: res.columns, rows: res.rows, count: res.count })
    })
  }

  const onExport = () => {
    start(async () => {
      const res = await exportOperationsQueryCsv({
        filter: buildFilter(),
        columns,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      downloadCsv(res.fileName, res.csv)
    })
  }

  const onSave = () => {
    start(async () => {
      setError('')
      const res = await saveOperationsQuery({
        name: saveName,
        filter: buildFilter(),
        columns,
        shareScope,
        sharedWithRole: shareScope === 'ROLE' ? sharedRole : null,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSaveName('')
      refreshSaved()
    })
  }

  const onLoadSaved = (id: string) => {
    start(async () => {
      setError('')
      const res = await loadSavedQuery(id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      const filter = res.filter as {
        op?: 'AND' | 'OR'
        clauses?: { field: string; op: string; value?: unknown }[]
      }
      if (filter?.op) setGroupOp(filter.op)
      if (Array.isArray(filter?.clauses)) {
        setClauses(
          filter.clauses
            .filter((c) => 'field' in c)
            .map((c) => ({
              field: c.field,
              op: c.op,
              value:
                c.value == null
                  ? ''
                  : Array.isArray(c.value)
                    ? c.value.join(', ')
                    : String(c.value),
            }))
        )
      }
      if (res.columns?.length) setColumns(res.columns)
      setSaveName(res.name)
      setShareScope(res.shareScope)
      if (res.sharedWithRole) setSharedRole(res.sharedWithRole)
    })
  }

  return (
    <ReportShell
      title="Query builder"
      description="Guided, whitelist-only filters over your visible clients. No raw SQL. Re-running a shared query always applies your own RBAC scope."
      summary={result ? `${result.count} rows (max 500)` : undefined}
      pending={pending}
      onRefresh={run}
      onExport={result ? onExport : undefined}
    >
      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-quiet">
              Match
            </span>
            <select
              value={groupOp}
              onChange={(e) => setGroupOp(e.target.value as 'AND' | 'OR')}
              className="h-8 rounded-lg border border-line bg-surface px-2 text-sm"
            >
              <option value="AND">All filters (AND)</option>
              <option value="OR">Any filter (OR)</option>
            </select>
          </div>

          {clauses.map((c, idx) => (
            <div
              key={idx}
              className="grid gap-2 sm:grid-cols-[1.2fr_0.7fr_1.2fr_auto]"
            >
              <select
                value={c.field}
                onChange={(e) => {
                  const field = e.target.value
                  const ops = FIELD_OPS[field] ?? ['eq']
                  setClauses((prev) =>
                    prev.map((row, i) =>
                      i === idx
                        ? { field, op: ops[0]!, value: row.value }
                        : row
                    )
                  )
                }}
                className="h-9 rounded-lg border border-line px-2 text-sm"
              >
                {QUERY_FILTER_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select
                value={c.op}
                onChange={(e) =>
                  setClauses((prev) =>
                    prev.map((row, i) =>
                      i === idx ? { ...row, op: e.target.value } : row
                    )
                  )
                }
                className="h-9 rounded-lg border border-line px-2 text-sm"
              >
                {(FIELD_OPS[c.field] ?? ['eq']).map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              <input
                value={c.value}
                onChange={(e) =>
                  setClauses((prev) =>
                    prev.map((row, i) =>
                      i === idx ? { ...row, value: e.target.value } : row
                    )
                  )
                }
                placeholder={
                  c.op === 'in'
                    ? 'Comma-separated values'
                    : c.field === 'payerType'
                      ? 'medicaid | commercial'
                      : c.field === 'language'
                        ? 'Not tracked'
                        : 'Value'
                }
                disabled={c.op === 'true' || c.op === 'false'}
                className="h-9 rounded-lg border border-line px-2.5 text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() =>
                  setClauses((prev) => prev.filter((_, i) => i !== idx))
                }
                className="h-9 rounded-lg border border-line px-2 text-xs text-[var(--urgent)]"
              >
                Remove
              </button>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setClauses((prev) => [
                  ...prev,
                  { field: 'stage', op: 'eq', value: '' },
                ])
              }
              className="h-9 rounded-lg border border-line px-3 text-xs font-medium"
            >
              Add filter
            </button>
            <button
              type="button"
              onClick={run}
              disabled={pending || clauses.length === 0}
              className="h-9 rounded-lg bg-[var(--sunrise)] px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              Run query
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <h3 className="text-sm font-semibold text-ink">Saved queries</h3>
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name this filter set"
            className="h-9 w-full rounded-lg border border-line px-2.5 text-sm"
          />
          <select
            value={shareScope}
            onChange={(e) =>
              setShareScope(e.target.value as SavedQueryShareScope)
            }
            className="h-9 w-full rounded-lg border border-line px-2 text-sm"
          >
            <option value="PRIVATE">Private</option>
            <option value="ROLE">Share with role</option>
            <option value="FULL_ACCESS">Share with full-access</option>
          </select>
          {shareScope === 'ROLE' ? (
            <select
              value={sharedRole}
              onChange={(e) => setSharedRole(e.target.value as CrmRole)}
              className="h-9 w-full rounded-lg border border-line px-2 text-sm"
            >
              {(
                [
                  'INTAKE',
                  'CLINICAL',
                  'AUTHORIZATION',
                  'STAFFING',
                  'CASE_COORDINATION',
                  'BILLING',
                  'MANAGEMENT',
                ] as CrmRole[]
              ).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !saveName.trim()}
            className="h-9 w-full rounded-lg border border-line text-xs font-medium disabled:opacity-50"
          >
            Save filter definition
          </button>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
            {saved.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-line/80 px-2 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => onLoadSaved(q.id)}
                  className="min-w-0 truncate text-left text-ink hover:underline"
                >
                  {q.name}
                </button>
                {q.isOwner ? (
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        await deleteSavedQuery(q.id)
                        refreshSaved()
                      })
                    }
                    className="text-xs text-[var(--urgent)]"
                  >
                    Delete
                  </button>
                ) : (
                  <span className="text-[10px] uppercase text-quiet">Shared</span>
                )}
              </li>
            ))}
            {!saved.length ? (
              <li className="text-xs text-quiet">No saved queries yet.</li>
            ) : null}
          </ul>
        </div>
      </div>

      {result ? (
        <div className="mt-4">
          <ReportTable columns={result.columns} rows={result.rows} />
        </div>
      ) : null}
    </ReportShell>
  )
}

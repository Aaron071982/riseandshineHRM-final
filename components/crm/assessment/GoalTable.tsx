'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  GOAL_STATUSES,
  type GoalRowColumnA,
  type GoalRowColumnB,
} from '@/lib/crm/assessment/assessment.schema'
import { GOAL_STATUS_LABELS, goalRequiresRationale } from '@/lib/crm/assessment/reassessment'
import { defaultTargetMasteryDate } from '@/lib/crm/assessment/targetMasteryDate'
import {
  PreviousValueNote,
  carriedInputClass,
  useCarryState,
} from '@/components/crm/assessment/carryForward'
import { cn } from '@/lib/utils'

type CommonProps = {
  readOnly?: boolean
  onBlur?: () => void
  /** Show reassessment status / date mastered / rationale columns. */
  reassessment?: boolean
}

type GoalTableProps =
  | (CommonProps & {
      variant: 'A'
      rows: GoalRowColumnA[]
      onChange: (rows: GoalRowColumnA[]) => void
      previousRows?: GoalRowColumnA[]
    })
  | (CommonProps & {
      variant: 'B'
      rows: GoalRowColumnB[]
      onChange: (rows: GoalRowColumnB[]) => void
      previousRows?: GoalRowColumnB[]
    })

type AnyRow = GoalRowColumnA | GoalRowColumnB

/**
 * plan: carried from the predecessor as-is (marked until edited).
 * previous: auto-filled from the predecessor's Current Performance.
 */
type Col = { key: string; label: string; kind: 'plan' | 'previous' | 'current' }

const COLS_A: Col[] = [
  { key: 'goalName', label: 'Goal Name', kind: 'plan' },
  { key: 'objective', label: 'Objective', kind: 'plan' },
  { key: 'baseline', label: 'Baseline', kind: 'plan' },
  { key: 'previousAssessmentScore', label: 'Previous Assessment Score', kind: 'previous' },
  { key: 'currentPerformance', label: 'Current Performance', kind: 'current' },
  { key: 'masteryCriteria', label: 'Mastery Criteria', kind: 'plan' },
  { key: 'targetMasteryDate', label: 'Target Mastery Date', kind: 'plan' },
]

const COLS_B: Col[] = [
  { key: 'goal', label: 'Goal', kind: 'plan' },
  { key: 'baselinePerformance', label: 'Baseline Performance', kind: 'plan' },
  { key: 'previousAssessmentPerformance', label: 'Previous Assessment Performance', kind: 'previous' },
  { key: 'currentPerformance', label: 'Current Performance', kind: 'current' },
  { key: 'masteryCriteria', label: 'Mastery Criteria', kind: 'plan' },
  { key: 'targetMasteryDate', label: 'Target Mastery Date', kind: 'plan' },
  { key: 'methodsToBeUtilized', label: 'Methods to be Utilized', kind: 'plan' },
]

function newRowId() {
  return crypto.randomUUID()
}

function emptyRow(variant: 'A' | 'B'): AnyRow {
  const base = {
    id: newRowId(),
    currentPerformance: '',
    masteryCriteria: '',
    targetMasteryDate: defaultTargetMasteryDate(),
    status: '' as const,
    dateMastered: '',
    rationale: '',
  }
  if (variant === 'A') {
    return { ...base, goalName: '', objective: '', baseline: '', previousAssessmentScore: '' }
  }
  return {
    ...base,
    goal: '',
    baselinePerformance: '',
    previousAssessmentPerformance: '',
    methodsToBeUtilized: '',
  }
}

function CellInput({
  fieldKey,
  kind,
  value,
  previousValue,
  onChange,
  onBlur,
  readOnly,
}: {
  fieldKey: string
  kind: Col['kind']
  value: string
  previousValue: string | undefined
  onChange: (v: string) => void
  onBlur?: () => void
  readOnly?: boolean
}) {
  const isMastery = fieldKey === 'targetMasteryDate'
  const carry = useCarryState(value, kind === 'plan' ? previousValue : undefined)
  const autoFilled = kind === 'previous' && previousValue !== undefined && value.trim() !== ''
  return (
    <div className="space-y-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        readOnly={readOnly}
        placeholder={isMastery ? 'MM/YYYY' : undefined}
        inputMode={isMastery ? 'numeric' : undefined}
        title={
          carry.state === 'carried'
            ? 'Carried forward from the previous assessment — not edited yet'
            : autoFilled
              ? "Auto-filled from the previous assessment's Current Performance"
              : undefined
        }
        className={cn(
          'min-w-[120px] text-xs',
          carriedInputClass(carry.state),
          autoFilled && 'bg-canvas/70 italic text-quiet'
        )}
      />
      <PreviousValueNote value={previousValue} show={carry.compare && carry.state === 'changed'} />
    </div>
  )
}

export function GoalTable(props: GoalTableProps) {
  const { readOnly, onBlur, reassessment, variant } = props
  const rows = props.rows as AnyRow[]
  const previousById = new Map((props.previousRows as AnyRow[] | undefined)?.map((r) => [r.id, r]))
  const cols = variant === 'A' ? COLS_A : COLS_B

  const emit = (next: AnyRow[]) => {
    ;(props.onChange as (rows: AnyRow[]) => void)(next)
  }
  const update = (id: string, patch: Partial<Record<string, string>>) =>
    emit(rows.map((r) => (r.id === id ? ({ ...r, ...patch } as AnyRow) : r)))

  const headers = [
    ...cols.map((c) => c.label),
    ...(reassessment ? ['Status', 'Date Mastered', 'Rationale'] : []),
  ]

  return (
    <GoalTableShell cols={headers} readOnly={readOnly} onAdd={() => emit([...rows, emptyRow(variant)])}>
      {rows.map((row) => {
        const prevRow = previousById.get(row.id)
        const record = row as unknown as Record<string, string>
        const prevRecord = prevRow as unknown as Record<string, string> | undefined
        const rationaleMissing =
          reassessment && goalRequiresRationale(row.status) && !row.rationale.trim()
        return (
          <tr key={row.id} className="border-t border-line">
            {cols.map((col) => (
              <td key={col.key} className="p-1 align-top">
                <CellInput
                  fieldKey={col.key}
                  kind={col.kind}
                  value={record[col.key] ?? ''}
                  previousValue={
                    !prevRecord
                      ? undefined
                      : col.kind === 'previous'
                        ? prevRecord.currentPerformance
                        : prevRecord[col.key]
                  }
                  onChange={(v) => update(row.id, { [col.key]: v })}
                  onBlur={onBlur}
                  readOnly={readOnly}
                />
              </td>
            ))}
            {reassessment && (
              <>
                <td className="p-1 align-top">
                  <select
                    value={row.status}
                    onChange={(e) => update(row.id, { status: e.target.value })}
                    onBlur={onBlur}
                    disabled={readOnly}
                    aria-label="Goal status"
                    className={cn(
                      'min-w-[130px] rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink',
                      !row.status && 'border-dashed text-quiet'
                    )}
                  >
                    <option value="">Select status…</option>
                    {GOAL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {GOAL_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1 align-top">
                  <Input
                    type="date"
                    value={row.dateMastered}
                    onChange={(e) => update(row.id, { dateMastered: e.target.value })}
                    onBlur={onBlur}
                    readOnly={readOnly}
                    disabled={row.status !== 'MASTERED'}
                    aria-label="Date mastered"
                    className="min-w-[130px] text-xs disabled:opacity-40"
                  />
                </td>
                <td className="p-1 align-top">
                  <Input
                    value={row.rationale}
                    onChange={(e) => update(row.id, { rationale: e.target.value })}
                    onBlur={onBlur}
                    readOnly={readOnly}
                    placeholder={goalRequiresRationale(row.status) ? 'Required' : 'Optional'}
                    aria-invalid={rationaleMissing || undefined}
                    aria-label="Rationale"
                    className={cn(
                      'min-w-[180px] text-xs',
                      rationaleMissing && 'border-[var(--urgent-fg)] ring-1 ring-[var(--urgent-fg)]/40'
                    )}
                  />
                  {rationaleMissing && (
                    <p className="mt-0.5 text-[11px] font-medium text-[var(--urgent-fg)]">
                      ! Rationale required for {GOAL_STATUS_LABELS[row.status as keyof typeof GOAL_STATUS_LABELS]}
                    </p>
                  )}
                </td>
              </>
            )}
            {!readOnly && (
              <td className="p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => emit(rows.filter((r) => r.id !== row.id))}
                >
                  Remove
                </Button>
              </td>
            )}
          </tr>
        )
      })}
    </GoalTableShell>
  )
}

function GoalTableShell({
  cols,
  children,
  readOnly,
  onAdd,
}: {
  cols: string[]
  children: React.ReactNode
  readOnly?: boolean
  onAdd: () => void
}) {
  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="w-full min-w-[800px] border border-line text-left text-xs">
        <thead className="bg-canvas/60">
          <tr>
            {cols.map((label) => (
              <th key={label} className="p-2 font-medium text-ink">
                {label}
              </th>
            ))}
            {!readOnly && <th className="p-2 w-20" />}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {!readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          Add row
        </Button>
      )}
    </div>
  )
}

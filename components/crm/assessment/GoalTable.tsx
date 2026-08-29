'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type {
  GoalRowColumnA,
  GoalRowColumnB,
} from '@/lib/crm/assessment/assessment.schema'

type GoalTableProps =
  | {
      variant: 'A'
      rows: GoalRowColumnA[]
      onChange: (rows: GoalRowColumnA[]) => void
      readOnly?: boolean
      onBlur?: () => void
    }
  | {
      variant: 'B'
      rows: GoalRowColumnB[]
      onChange: (rows: GoalRowColumnB[]) => void
      readOnly?: boolean
      onBlur?: () => void
    }

function newRowId() {
  return crypto.randomUUID()
}

export function GoalTable(props: GoalTableProps) {
  const { readOnly, onBlur } = props

  const addRow = () => {
    if (props.variant === 'A') {
      props.onChange([
        ...props.rows,
        {
          id: newRowId(),
          goalName: '',
          objective: '',
          baseline: '',
          previousAssessmentScore: '',
          currentPerformance: '',
          masteryCriteria: '',
          targetMasteryDate: '',
        },
      ])
    } else {
      props.onChange([
        ...props.rows,
        {
          id: newRowId(),
          goal: '',
          baselinePerformance: '',
          previousAssessmentPerformance: '',
          currentPerformance: '',
          masteryCriteria: '',
          targetMasteryDate: '',
          methodsToBeUtilized: '',
        },
      ])
    }
  }

  const removeRow = (id: string) => {
    if (props.variant === 'A') {
      props.onChange(props.rows.filter((r) => r.id !== id))
    } else {
      props.onChange(props.rows.filter((r) => r.id !== id))
    }
  }

  if (props.variant === 'A') {
    const cols: { key: keyof GoalRowColumnA; label: string }[] = [
      { key: 'goalName', label: 'Goal Name' },
      { key: 'objective', label: 'Objective' },
      { key: 'baseline', label: 'Baseline' },
      { key: 'previousAssessmentScore', label: 'Previous Assessment Score' },
      { key: 'currentPerformance', label: 'Current Performance' },
      { key: 'masteryCriteria', label: 'Mastery Criteria' },
      { key: 'targetMasteryDate', label: 'Target Mastery Date' },
    ]
    return (
      <GoalTableShell
        cols={cols.map((c) => c.label)}
        readOnly={readOnly}
        onAdd={addRow}
      >
        {props.rows.map((row) => (
          <tr key={row.id} className="border-t border-line">
            {cols.map((col) => (
              <td key={col.key} className="p-1 align-top">
                <Input
                  value={row[col.key] as string}
                  onChange={(e) =>
                    props.onChange(
                      props.rows.map((r) =>
                        r.id === row.id ? { ...r, [col.key]: e.target.value } : r
                      )
                    )
                  }
                  onBlur={onBlur}
                  readOnly={readOnly}
                  className="min-w-[120px] text-xs"
                />
              </td>
            ))}
            {!readOnly && (
              <td className="p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.id)}
                >
                  Remove
                </Button>
              </td>
            )}
          </tr>
        ))}
      </GoalTableShell>
    )
  }

  const colsB: { key: keyof GoalRowColumnB; label: string }[] = [
    { key: 'goal', label: 'Goal' },
    { key: 'baselinePerformance', label: 'Baseline Performance' },
    { key: 'previousAssessmentPerformance', label: 'Previous Assessment Performance' },
    { key: 'currentPerformance', label: 'Current Performance' },
    { key: 'masteryCriteria', label: 'Mastery Criteria' },
    { key: 'targetMasteryDate', label: 'Target Mastery Date' },
    { key: 'methodsToBeUtilized', label: 'Methods to be Utilized' },
  ]

  return (
    <GoalTableShell
      cols={colsB.map((c) => c.label)}
      readOnly={readOnly}
      onAdd={addRow}
    >
      {props.rows.map((row) => (
        <tr key={row.id} className="border-t border-line">
          {colsB.map((col) => (
            <td key={col.key} className="p-1 align-top">
              <Input
                value={row[col.key] as string}
                onChange={(e) =>
                  props.onChange(
                    props.rows.map((r) =>
                      r.id === row.id ? { ...r, [col.key]: e.target.value } : r
                    )
                  )
                }
                onBlur={onBlur}
                readOnly={readOnly}
                className="min-w-[120px] text-xs"
              />
            </td>
          ))}
          {!readOnly && (
            <td className="p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(row.id)}
              >
                Remove
              </Button>
            </td>
          )}
        </tr>
      ))}
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

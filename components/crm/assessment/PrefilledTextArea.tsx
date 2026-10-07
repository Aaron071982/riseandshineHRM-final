'use client'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  CarryBadge,
  PreviousValueNote,
  carriedInputClass,
  useCarryState,
} from '@/components/crm/assessment/carryForward'
import { cn } from '@/lib/utils'

type PrefilledTextAreaProps = {
  label?: string
  value: string
  onChange: (value: string) => void
  defaultText?: string
  readOnly?: boolean
  rows?: number
  onBlur?: () => void
  /** Predecessor's value on a reassessment; enables carried-forward marking. */
  previousValue?: string
}

export function PrefilledTextArea({
  label,
  value,
  onChange,
  readOnly,
  rows = 6,
  onBlur,
  previousValue,
}: PrefilledTextAreaProps) {
  const carry = useCarryState(value, previousValue)
  const badge = carry.state === 'carried' || carry.state === 'reviewed'
  return (
    <div className="space-y-2">
      {(label || badge) && (
        <div className="flex flex-wrap items-center gap-2">
          {label && <Label>{label}</Label>}
          {badge && <CarryBadge state={carry.state} />}
        </div>
      )}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        readOnly={readOnly}
        rows={rows}
        className={cn('font-normal', carriedInputClass(carry.state))}
      />
      <PreviousValueNote value={previousValue} show={carry.compare && carry.state === 'changed'} />
    </div>
  )
}

export function DisplayBoilerplate({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap rounded-lg border border-line bg-canvas/50 p-3 text-sm text-quiet">
      {text}
    </p>
  )
}

'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export type CheckboxOption = {
  key: string
  label: string
}

type CheckboxGroupProps = {
  options: CheckboxOption[]
  values: Record<string, boolean>
  onChange: (key: string, checked: boolean) => void
  readOnly?: boolean
  otherKey?: string
  otherText?: string
  onOtherTextChange?: (text: string) => void
}

export function CheckboxGroup({
  options,
  values,
  onChange,
  readOnly,
  otherKey,
  otherText,
  onOtherTextChange,
}: CheckboxGroupProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => (
        <label key={opt.key} className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={!!values[opt.key]}
            onCheckedChange={(c) => onChange(opt.key, c === true)}
            disabled={readOnly}
          />
          <span>{opt.label}</span>
        </label>
      ))}
      {otherKey && values[otherKey] && (
        <div className="col-span-full space-y-1">
          <Label htmlFor="crisis-other">Other — specify</Label>
          <input
            id="crisis-other"
            type="text"
            value={otherText ?? ''}
            onChange={(e) => onOtherTextChange?.(e.target.value)}
            disabled={readOnly}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  )
}

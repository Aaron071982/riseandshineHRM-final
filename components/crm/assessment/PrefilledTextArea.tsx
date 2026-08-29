'use client'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type PrefilledTextAreaProps = {
  label?: string
  value: string
  onChange: (value: string) => void
  defaultText?: string
  readOnly?: boolean
  rows?: number
  onBlur?: () => void
}

export function PrefilledTextArea({
  label,
  value,
  onChange,
  readOnly,
  rows = 6,
  onBlur,
}: PrefilledTextAreaProps) {
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        readOnly={readOnly}
        rows={rows}
        className="font-normal"
      />
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

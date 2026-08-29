'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ContactField } from '@/lib/crm/assessment/assessment.schema'

type ContactFieldEditorProps = {
  label: string
  value: ContactField
  onChange: (value: ContactField) => void
  readOnly?: boolean
  onBlur?: () => void
}

export function ContactFieldEditor({
  label,
  value,
  onChange,
  readOnly,
  onBlur,
}: ContactFieldEditorProps) {
  const set = (key: keyof ContactField, v: string) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <p className="text-sm font-medium text-ink">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input
            value={value.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </div>
        <div>
          <Label>Organization</Label>
          <Input
            value={value.organization ?? ''}
            onChange={(e) => set('organization', e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            value={value.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={value.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  )
}

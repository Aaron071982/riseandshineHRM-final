'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatUsd } from '@/lib/billing/format'
import { cn } from '@/lib/utils'

export default function PayRateInput({
  value,
  suggested,
  onSave,
  disabled,
}: {
  value: number | null
  suggested?: number | null
  onSave: (rate: number | null) => Promise<void>
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setDraft(value != null ? String(value) : '')
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const parsed = draft.trim() === '' ? null : parseFloat(draft)
      await onSave(parsed != null && !Number.isNaN(parsed) ? parsed : null)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 w-24"
          disabled={saving}
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-xs text-[#0D9488] font-medium"
        >
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="min-w-[100px]">
      <button
        type="button"
        onClick={startEdit}
        disabled={disabled}
        className={cn(
          'text-left text-sm',
          value == null && 'text-red-600 dark:text-red-400 font-semibold',
          !disabled && 'hover:underline'
        )}
      >
        {value != null ? formatUsd(value) : 'No rate set'}
      </button>
      {value == null && suggested != null && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Suggested: {formatUsd(suggested)}
        </p>
      )}
    </div>
  )
}

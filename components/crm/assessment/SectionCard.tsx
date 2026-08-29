'use client'

import { cn } from '@/lib/utils'

type SectionCardProps = {
  id?: string
  title: string
  children: React.ReactNode
  onSave?: () => void
  saving?: boolean
  readOnly?: boolean
  className?: string
}

export function SectionCard({
  id,
  title,
  children,
  onSave,
  saving,
  readOnly,
  className,
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-xl border border-line bg-surface overflow-hidden',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line bg-[#E7692C]/10 px-4 py-3">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        {onSave && !readOnly && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save section'}
          </button>
        )}
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

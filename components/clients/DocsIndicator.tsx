'use client'

import { cn } from '@/lib/utils'

export default function DocsIndicator({ done, total }: { done: number; total: number }) {
  const empty = done === 0
  const pips = 3
  const filled = total > 0 ? Math.round((done / total) * pips) : 0

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'text-xs tabular-nums font-medium',
          empty ? 'text-sem-amber' : 'text-quiet'
        )}
      >
        {done}/{total}
      </span>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: pips }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 w-2.5 rounded-sm"
            style={{
              background:
                i < filled
                  ? empty
                    ? 'var(--amber)'
                    : 'var(--faint)'
                  : 'var(--line-2)',
            }}
          />
        ))}
      </span>
    </div>
  )
}

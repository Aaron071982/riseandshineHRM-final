'use client'

import { useEffect, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'

type Result = { id: string; name: string; email: string | null; status?: string }

export function ProfilePicker({
  mode,
  valueId,
  valueLabel,
  onSelect,
  searchFn,
  placeholder = 'Search…',
  disabled,
}: {
  mode: 'rbt' | 'bcba'
  valueId: string | null
  valueLabel: string | null
  onSelect: (id: string | null, label: string | null) => void
  searchFn: (
    q: string
  ) => Promise<
    | { ok: true; results: Result[] }
    | { ok: false; error: string }
  >
  placeholder?: string
  disabled?: boolean
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await searchFn(q)
        if (res.ok) setResults(res.results)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [q, open, searchFn])

  return (
    <div className="relative min-w-[14rem] flex-1">
      <input
        disabled={disabled}
        value={open ? q : valueLabel ?? ''}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          setQ('')
        }}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
      />
      {valueId && !open && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(null, null)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-quiet hover:text-ink"
        >
          Clear
        </button>
      )}
      {open && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-surface shadow-lg">
          {pending && (
            <li className="px-3 py-2 text-xs text-quiet">Searching…</li>
          )}
          {!pending && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-quiet">
              No {mode === 'rbt' ? 'RBTs' : 'BCBAs'} found
            </li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-line-2',
                  r.id === valueId && 'bg-[color-mix(in_srgb,var(--brand)_8%,white)]'
                )}
                onClick={() => {
                  onSelect(r.id, r.name)
                  setOpen(false)
                  setQ('')
                }}
              >
                <span className="font-medium text-ink">{r.name}</span>
                <span className="text-xs text-quiet">
                  {r.email || (r.status ?? '')}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs text-quiet hover:bg-line-2"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

/** Days until expiration banding for authorization display. */
export function expiryBand(expirationDate: string | Date | null): {
  days: number | null
  tone: 'neutral' | 'info' | 'warning' | 'urgent'
  label: string
} {
  if (!expirationDate) {
    return { days: null, tone: 'neutral', label: 'No expiration' }
  }
  const end = new Date(expirationDate)
  end.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (days < 0) {
    return { days, tone: 'urgent', label: `Expired ${Math.abs(days)}d ago` }
  }
  if (days <= 7) return { days, tone: 'urgent', label: `${days}d left` }
  if (days <= 15) return { days, tone: 'warning', label: `${days}d left` }
  if (days <= 30) return { days, tone: 'warning', label: `${days}d left` }
  if (days <= 60) return { days, tone: 'info', label: `${days}d left` }
  return { days, tone: 'neutral', label: `${days}d left` }
}

export const EXPIRY_TONE_CLASS = {
  neutral: 'bg-[var(--slate-bg)] text-[var(--slate)]',
  info: 'bg-[var(--blue-bg)] text-[var(--blue)]',
  warning: 'bg-[var(--amber-bg)] text-[var(--amber)]',
  urgent: 'bg-[var(--urgent-bg)] text-[var(--urgent)]',
} as const

export function UnitsBar({
  used,
  authorized,
}: {
  used: number
  authorized: number
}) {
  const pct =
    authorized > 0 ? Math.min(100, Math.round((used / authorized) * 100)) : 0
  const urgent = pct >= 90
  const warn = pct >= 75 && !urgent
  return (
    <div className="min-w-[8rem]">
      <div className="mb-0.5 flex justify-between text-[11px] tabular-nums text-quiet">
        <span>
          {used} / {authorized}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: urgent
              ? 'var(--urgent)'
              : warn
                ? 'var(--amber)'
                : 'linear-gradient(90deg, var(--sunrise-a), var(--sunrise-b))',
          }}
        />
      </div>
    </div>
  )
}

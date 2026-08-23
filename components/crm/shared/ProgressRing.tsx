'use client'

import { cn } from '@/lib/utils'

export function ProgressRing({
  percent,
  size = 56,
  stroke = 5,
  className,
}: {
  percent: number
  size?: number
  stroke?: number
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#sunrise-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
        <defs>
          <linearGradient id="sunrise-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--sunrise-a)" />
            <stop offset="100%" stopColor="var(--brand)" />
          </linearGradient>
        </defs>
      </svg>
      <span
        className="absolute font-display text-sm font-semibold tabular-nums text-ink"
        style={{ fontSize: size < 48 ? 11 : 14 }}
      >
        {percent}%
      </span>
    </div>
  )
}

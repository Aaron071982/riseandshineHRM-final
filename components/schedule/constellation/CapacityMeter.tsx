'use client'

import { fmtH } from '@/lib/schedule/utils'
import { BAND_META, utilizationBand } from '@/lib/schedule/constellation'
import { cn } from '@/lib/utils'

export function formatReading(hours: number, target: number): string {
  return `${hours.toFixed(1)} / ${fmtH(target)} hrs`
}

export default function CapacityMeter({
  hours,
  target,
  size = 'md',
  showLabel = true,
}: {
  hours: number
  target: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}) {
  const band = utilizationBand(hours, target)
  const meta = BAND_META[band]
  const pct = target > 0 ? hours / target : 0
  const fill = Math.min(pct, 1) * 100
  const over = Math.max(hours - target, 0)

  return (
    <div className="space-y-1">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={hours}
        aria-label={`${formatReading(hours, target)} — ${meta.short}`}
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-[var(--line-2)] ring-1 ring-inset ring-[var(--line)]',
          size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'
        )}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${fill}%`,
            backgroundColor: meta.color,
            backgroundImage:
              band === 'over'
                ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.45) 0 4px, transparent 4px 8px)'
                : undefined,
          }}
        />
        {[50, 90].map((tick) => (
          <span
            key={tick}
            aria-hidden
            className="absolute inset-y-0 w-px bg-white/80"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>
      {showLabel && (
        <div className="flex items-center justify-between gap-2 text-[11px] leading-none">
          <span className="font-semibold tabular-nums text-[var(--espresso)]">{formatReading(hours, target)}</span>
          <span className="flex items-center gap-1 font-medium" style={{ color: meta.color }}>
            <span aria-hidden>{meta.symbol}</span>
            {band === 'over' ? `+${fmtH(over)} over` : `${Math.round(pct * 100)}%`}
          </span>
        </div>
      )}
    </div>
  )
}

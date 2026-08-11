'use client'

export default function HoursBar({
  scheduled,
  target,
}: {
  scheduled: number
  target: number
}) {
  const pct =
    target > 0 ? Math.min(100, Math.round((scheduled / target) * 100)) : scheduled > 0 ? 100 : 0

  return (
    <div className="min-w-[7.5rem]">
      <div className="text-right text-xs tabular-nums text-ink">
        {scheduled}
        <span className="text-faint">/{target}</span> hrs
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-2">
        <div
          className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--sunrise-a), var(--sunrise-b))',
          }}
        />
      </div>
    </div>
  )
}

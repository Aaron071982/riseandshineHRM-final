'use client'

import { cn } from '@/lib/utils'
import type { PortalLifecycleSnapshot } from '@/lib/crm/portalLifecycle'

export function PortalStageStrip({
  lifecycle,
  className,
  size = 'md',
}: {
  lifecycle: PortalLifecycleSnapshot
  className?: string
  size?: 'sm' | 'md'
}) {
  const dot = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
  const gap = size === 'sm' ? 'gap-0' : 'gap-0'

  return (
    <div className={cn('min-w-[9.5rem]', className)}>
      <div className={cn('flex items-center', gap)} aria-hidden>
        {lifecycle.stages.map((stage, i) => {
          const isCurrent = i === lifecycle.currentIndex
          const filled = stage.done || isCurrent
          return (
            <div key={stage.id} className="flex flex-1 items-center last:flex-none">
              <span
                className={cn(
                  'relative z-[1] shrink-0 rounded-full transition-colors',
                  dot,
                  stage.done
                    ? 'bg-[var(--portal-orange)]'
                    : isCurrent
                      ? 'bg-[var(--portal-orange)] ring-2 ring-[color-mix(in_srgb,var(--portal-orange)_35%,transparent)] ring-offset-1 ring-offset-[var(--portal-paper)]'
                      : 'bg-[#D6CBBE]'
                )}
                title={stage.label}
              />
              {i < lifecycle.stages.length - 1 ? (
                <span
                  className={cn(
                    'mx-0.5 h-[2px] min-w-[10px] flex-1 rounded-full',
                    stage.done ? 'bg-[var(--portal-orange)]' : 'bg-[#E5DDD2]'
                  )}
                />
              ) : null}
            </div>
          )
        })}
      </div>
      <p
        className={cn(
          'mt-1 truncate font-medium text-[var(--espresso)]',
          size === 'sm' ? 'text-[10px]' : 'text-xs'
        )}
      >
        {lifecycle.currentLabel}
      </p>
    </div>
  )
}

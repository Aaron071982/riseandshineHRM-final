'use client'

import { createContext, useContext } from 'react'
import type { AssessmentSectionKey } from '@/lib/crm/assessment/assessment.schema'

type CarryForwardState = {
  /** True on a reassessment that has a predecessor to compare against. */
  enabled: boolean
  compare: boolean
  /** e.g. "Mar 3, 2026 assessment" */
  previousLabel: string
  reviewedSections: Record<string, string>
}

const CarryForwardContext = createContext<CarryForwardState>({
  enabled: false,
  compare: false,
  previousLabel: '',
  reviewedSections: {},
})

const SectionKeyContext = createContext<AssessmentSectionKey | null>(null)

export const CarryForwardProvider = CarryForwardContext.Provider
export const CarryForwardSection = SectionKeyContext.Provider

export function useCarryForward() {
  return useContext(CarryForwardContext)
}

export type CarryState = 'none' | 'carried' | 'reviewed' | 'changed'

/** How a field relates to its predecessor value inside the current section. */
export function useCarryState(value: unknown, previousValue: unknown): {
  state: CarryState
  compare: boolean
} {
  const ctx = useContext(CarryForwardContext)
  const sectionKey = useContext(SectionKeyContext)
  if (!ctx.enabled || previousValue === undefined) return { state: 'none', compare: false }
  if (value !== previousValue) return { state: 'changed', compare: ctx.compare }
  const isBlank = typeof value === 'string' ? !value.trim() : value == null
  if (isBlank) return { state: 'none', compare: false }
  const reviewed = sectionKey ? Boolean(ctx.reviewedSections[sectionKey]) : false
  return { state: reviewed ? 'reviewed' : 'carried', compare: ctx.compare }
}

export function CarryBadge({ state }: { state: CarryState }) {
  if (state === 'carried') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900"
        title="Copied from the previous assessment and not edited since. Update it or mark the section reviewed."
      >
        <span aria-hidden>↻</span> Carried forward
      </span>
    )
  }
  if (state === 'reviewed') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-quiet"
        title="Unchanged from the previous assessment; reviewed for this period."
      >
        <span aria-hidden>✓</span> Reviewed, unchanged
      </span>
    )
  }
  return null
}

/** Small muted predecessor value, shown when "Compare to previous" is on and the value changed. */
export function PreviousValueNote({ value, show }: { value: string | undefined; show: boolean }) {
  if (!show || value === undefined) return null
  return (
    <p className="line-clamp-3 whitespace-pre-wrap text-[11px] leading-snug text-quiet" title={value || undefined}>
      <span className="font-medium">Previous:</span> {value.trim() ? value : <em>empty</em>}
    </p>
  )
}

/** Class for an input whose content is still the predecessor's. */
export function carriedInputClass(state: CarryState): string {
  if (state === 'carried') return 'border-l-4 border-l-amber-400 bg-amber-50/40'
  if (state === 'reviewed') return 'border-l-4 border-l-line'
  return ''
}

/** Wraps any field with a carried-forward badge and the compare note. */
export function CarryHint({ value, previous }: { value: string; previous: string | undefined }) {
  const { state, compare } = useCarryState(value, previous)
  return (
    <>
      {state !== 'none' && state !== 'changed' && <CarryBadge state={state} />}
      <PreviousValueNote value={previous} show={compare && state === 'changed'} />
    </>
  )
}

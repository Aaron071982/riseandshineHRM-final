import { getClampSummary } from '@/lib/billing/validateCycle'

type SessionLike = {
  rawActualMinutes?: number | null
  actualMinutes: number
  clampApplied?: boolean | null
  reviewFlag?: string | null
}

export default function ClampSummaryBanner({
  entries,
}: {
  entries: { isExcluded: boolean; sessions: SessionLike[] }[]
}) {
  const { reducedCount, hoursRemoved, needsReviewCount } = getClampSummary(entries)

  if (reducedCount === 0 && needsReviewCount === 0) return null

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        needsReviewCount > 0
          ? 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100'
          : 'border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-100'
      }`}
    >
      <p className="font-medium text-[#0D9488] dark:text-teal-300">
        Schedule-window payable rule
      </p>
      <p className="mt-1">
        {reducedCount} session{reducedCount === 1 ? '' : 's'} reduced by scheduled-window rule
        {hoursRemoved > 0.005 ? ` (${hoursRemoved.toFixed(2)} hrs removed)` : ''}.
        {needsReviewCount > 0 && (
          <>
            {' '}
            <span className="font-semibold text-red-800 dark:text-red-200">
              {needsReviewCount} session{needsReviewCount === 1 ? '' : 's'} need review
            </span>{' '}
            before finalize (date mismatch, no overlap, or missing times). Fix in Artemis and
            re-upload, or use Adjustments for authorized overages.
          </>
        )}
      </p>
    </div>
  )
}

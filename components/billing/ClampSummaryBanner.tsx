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
  const { varianceCount, underCount, overCount, hoursUnder, hoursOver, needsReviewCount } =
    getClampSummary(entries)

  if (varianceCount === 0 && needsReviewCount === 0) {
    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-100">
        <p className="font-medium text-[#0D9488] dark:text-teal-300">Appointed-hours payable</p>
        <p className="mt-1">
          Paying appointment start–end for each session. Actual stay times are shown for reference
          only.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        needsReviewCount > 0
          ? 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100'
          : 'border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-teal-100'
      }`}
    >
      <p className="font-medium text-[#0D9488] dark:text-teal-300">Appointed-hours payable</p>
      <p className="mt-1">
        Paying appointment start–end (not early/late clock times).{' '}
        {varianceCount > 0 && (
          <>
            {varianceCount} session{varianceCount === 1 ? '' : 's'} where actual stay differed
            {underCount > 0
              ? ` — ${underCount} under by ${hoursUnder.toFixed(2)} hrs`
              : ''}
            {overCount > 0
              ? `${underCount > 0 ? ';' : ' —'} ${overCount} over by ${hoursOver.toFixed(2)} hrs`
              : ''}
            . Stay logs are shown for reference; payable hours stay at the appointed window.
          </>
        )}
        {needsReviewCount > 0 && (
          <>
            {' '}
            <span className="font-semibold text-red-800 dark:text-red-200">
              {needsReviewCount} session{needsReviewCount === 1 ? '' : 's'} need review
            </span>{' '}
            before finalize (date mismatch or missing appointment times).
          </>
        )}
      </p>
    </div>
  )
}

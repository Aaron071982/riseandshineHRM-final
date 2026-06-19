import { formatUsd } from '@/lib/billing/format'

export function CurrencyCell({ value }: { value: number | null | undefined }) {
  const isMissing = value == null
  return (
    <span className={isMissing ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
      {formatUsd(value)}
    </span>
  )
}

import {
  ARTEMIS_STATUS,
  normalizeArtemisStatus,
  statusLabel,
  type ArtemisSessionStatusKey,
} from '@/lib/billing/sessionStatus'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<ArtemisSessionStatusKey, string> = {
  [ARTEMIS_STATUS.SCHEDULED]: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  [ARTEMIS_STATUS.INCOMPLETE]: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  [ARTEMIS_STATUS.COMPLETED]: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200',
  [ARTEMIS_STATUS.READY_TO_BILL]: 'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200',
  [ARTEMIS_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
  [ARTEMIS_STATUS.CANCELLED]: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  [ARTEMIS_STATUS.DELETED]: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
}

function displayLabel(status: string | null): string {
  const key = normalizeArtemisStatus(status)
  if (!key) return status?.trim() || 'Unknown'
  if (key === ARTEMIS_STATUS.CANCELLED) return 'Cancelled'
  if (key === ARTEMIS_STATUS.DELETED) return 'Deleted'
  return statusLabel(key)
}

export default function SessionStatusBadge({
  status,
  className,
}: {
  status: string | null
  className?: string
}) {
  const key = normalizeArtemisStatus(status)
  const label = displayLabel(status)
  const style = key ? STATUS_STYLES[key] : 'bg-gray-100 text-gray-600'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
        style,
        className
      )}
    >
      {label}
    </span>
  )
}

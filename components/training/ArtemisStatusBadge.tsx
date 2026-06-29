import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ArtemisStatus } from '@/lib/training/artemisStatus'

const config: Record<
  ArtemisStatus,
  { label: string; className: string }
> = {
  TRAINED: {
    label: 'Artemis: Trained',
    className: 'bg-green-500 hover:bg-green-500 text-white border-0',
  },
  BOOKED: {
    label: 'Artemis: Booked',
    className: 'bg-amber-500 hover:bg-amber-500 text-white border-0',
  },
  NOT_STARTED: {
    label: 'Artemis: Not Started',
    className: 'bg-red-500 hover:bg-red-500 text-white border-0',
  },
}

export default function ArtemisStatusBadge({
  status,
  className,
}: {
  status: ArtemisStatus
  className?: string
}) {
  const c = config[status]
  return (
    <Badge className={cn(c.className, 'text-xs font-semibold', className)}>{c.label}</Badge>
  )
}

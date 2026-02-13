import SchedulingBeta from '@/components/admin/SchedulingBeta'

export const dynamic = 'force-dynamic'

export default function SchedulingBetaPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
          Scheduling System (beta)
        </h1>
        <p className="mt-2 text-gray-600 dark:text-[var(--text-tertiary)]">
          Connect clients and RBTs. Add clients, find the 3 closest RBTs by distance and preferences, and assign RBTs to clients for specific dates and times. Data is not saved between sessions.
        </p>
      </div>
      <SchedulingBeta />
    </div>
  )
}

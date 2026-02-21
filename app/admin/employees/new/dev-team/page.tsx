import AddDevTeamForm from '@/components/admin/AddDevTeamForm'
import Link from 'next/link'

export default function NewDevTeamPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/employees/new" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block">
          ← Back to Add menu
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Add Dev Team</h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">Create a new dev team, then add members on the team page</p>
      </div>
      <AddDevTeamForm />
    </div>
  )
}

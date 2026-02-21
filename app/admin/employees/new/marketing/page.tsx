import AddMarketingForm from '@/components/admin/AddMarketingForm'
import Link from 'next/link'

export default function NewMarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/employees/new" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block">
          ← Back to Add menu
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Add Marketing</h1>
        <p className="text-gray-600 dark:text-[var(--text-tertiary)] mt-1">Add a marketing team member</p>
      </div>
      <AddMarketingForm />
    </div>
  )
}

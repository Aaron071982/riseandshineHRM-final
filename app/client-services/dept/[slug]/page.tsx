import {
  assertCanAccessDepartment,
  CrmAccessError,
  getClientServicesUser,
} from '@/lib/crm/access'
import {
  DEPT_SLUG_TO_OWNER,
  isDeptSlug,
  loadDepartmentQueue,
} from '@/lib/crm/departments'
import DepartmentQueueClient from '@/components/crm/DepartmentQueueClient'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DepartmentQueuePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!isDeptSlug(slug)) notFound()

  const user = await getClientServicesUser()
  const dept = DEPT_SLUG_TO_OWNER[slug]

  try {
    assertCanAccessDepartment(user, dept)
  } catch (err) {
    if (err instanceof CrmAccessError) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-[var(--urgent)] bg-[var(--urgent-bg)] px-5 py-8 text-center">
          <h1 className="font-display text-lg font-semibold text-[var(--urgent)]">
            403 — Department access required
          </h1>
          <p className="mt-2 text-sm text-ink">
            You need the {dept.replace(/_/g, ' ').toLowerCase()} CRM role (or
            full access) to open this queue.
          </p>
        </div>
      )
    }
    throw err
  }

  const data = await loadDepartmentQueue(user, slug)
  return <DepartmentQueueClient data={data} />
}

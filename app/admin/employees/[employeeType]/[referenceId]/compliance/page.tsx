import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import EmployeeComplianceTabs from '@/components/admin/EmployeeComplianceTabs'
import { notFound } from 'next/navigation'
import {
  ensureEmployeeForBcbaProfile,
  ensureEmployeeForBillingProfile,
  ensureEmployeeForMarketingProfile,
  ensureEmployeeForCallCenterProfile,
} from '@/lib/employees'
import { Button } from '@/components/ui/button'

interface PageParams {
  employeeType: string
  referenceId: string
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TYPE_NORMALIZED = ['BCBA', 'BILLING', 'MARKETING', 'CALL_CENTER', 'RBT', 'DEV'] as const

export default async function EmployeeCompliancePage({
  params,
}: {
  params: Promise<PageParams>
}) {
  const { employeeType, referenceId } = await params
  const typeUpper = employeeType.toUpperCase()

  let employee = null
  try {
    employee = await prisma.employee.findFirst({
      where: {
        employeeType: typeUpper as any,
        referenceId,
      },
    })

    if (!employee && TYPE_NORMALIZED.includes(typeUpper as any)) {
      if (typeUpper === 'BCBA') {
        employee = await ensureEmployeeForBcbaProfile(referenceId)
      } else if (typeUpper === 'BILLING') {
        employee = await ensureEmployeeForBillingProfile(referenceId)
      } else if (typeUpper === 'MARKETING') {
        employee = await ensureEmployeeForMarketingProfile(referenceId)
      } else if (typeUpper === 'CALL_CENTER') {
        employee = await ensureEmployeeForCallCenterProfile(referenceId)
      }
    }

    if (!employee) {
      return notFound()
    }
  } catch (err) {
    console.error('[compliance page] failed to load employee', err)
    return (
      <div className="max-w-4xl mx-auto py-6 space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-6 text-center space-y-4">
          <h1 className="text-xl font-semibold text-amber-800 dark:text-amber-200">
            Compliance data isn’t available right now
          </h1>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This can happen if the database is still being updated or the connection failed. Try again in a moment or go back to the employee list.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/employees">Back to employees</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/admin/employees/${employeeType}/${referenceId}/compliance`}>Try again</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
        Compliance for {employee.displayName || employee.referenceId}
      </h1>
      <p className="text-sm text-gray-600 dark:text-[var(--text-tertiary)]">
        View documents, credentials, clinical activity, supervision, and alerts for this employee.
      </p>
      <EmployeeComplianceTabs
        employeeId={employee.id}
        employeeType={employee.employeeType}
        displayName={employee.displayName || employee.referenceId}
      />
    </div>
  )
}


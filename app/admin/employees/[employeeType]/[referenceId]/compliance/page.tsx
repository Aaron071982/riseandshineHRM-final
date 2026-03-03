import { prisma } from '@/lib/prisma'
import EmployeeComplianceTabs from '@/components/admin/EmployeeComplianceTabs'
import { notFound } from 'next/navigation'

interface PageParams {
  employeeType: string
  referenceId: string
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EmployeeCompliancePage({
  params,
}: {
  params: Promise<PageParams>
}) {
  const { employeeType, referenceId } = await params

  const employee = await prisma.employee.findFirst({
    where: {
      employeeType: employeeType.toUpperCase() as any,
      referenceId,
    },
  })

  if (!employee) {
    return notFound()
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


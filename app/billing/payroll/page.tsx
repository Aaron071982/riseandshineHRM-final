import PayrollAdminPage from '@/components/admin/PayrollAdminPage'

export const dynamic = 'force-dynamic'

/** Billing managers (non-admin) access the same payroll UI here. */
export default function BillingPayrollPage() {
  return <PayrollAdminPage />
}

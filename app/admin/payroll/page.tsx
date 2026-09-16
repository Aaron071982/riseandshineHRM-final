import { redirect } from 'next/navigation'

/** Legacy admin payroll path → unified Payroll & Billing hub. */
export default function AdminPayrollRedirect() {
  redirect('/billing?tab=payroll')
}

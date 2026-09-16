import { redirect } from 'next/navigation'

/** Legacy billing payroll path → unified hub (Payroll tab). */
export default function BillingPayrollRedirect() {
  redirect('/billing?tab=payroll')
}

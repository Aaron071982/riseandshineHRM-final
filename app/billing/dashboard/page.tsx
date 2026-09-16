import { redirect } from 'next/navigation'

/** Old teal dashboard → unified Payroll & Billing (Billing tab). */
export default function BillingDashboardRedirect() {
  redirect('/billing?tab=billing')
}

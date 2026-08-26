import { redirect } from 'next/navigation'

/** Query builder removed for now — use Dashboard reports. */
export default function OperationsQueryRedirect() {
  redirect('/client-services')
}

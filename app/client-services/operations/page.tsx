import { redirect } from 'next/navigation'

/** Operations lives on the Dashboard now. */
export default function OperationsHomeRedirect() {
  redirect('/client-services')
}

import { redirect } from 'next/navigation'

/** Org training list lives on Profile; keep module deep links. */
export default function RbtOrgTrainingIndexRedirect() {
  redirect('/rbt/profile#training')
}

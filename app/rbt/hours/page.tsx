import { redirect } from 'next/navigation'

/** Legacy clock/hours page — pay statements live under Sessions & Pay. */
export default function HoursPage() {
  redirect('/rbt/sessions')
}

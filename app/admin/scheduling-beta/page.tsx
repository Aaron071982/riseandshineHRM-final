import { redirect } from 'next/navigation'

/** Legacy scheduling demo — proximity search now lives in Client Services. */
export default function SchedulingBetaPage() {
  redirect('/client-services/therapist-search')
}

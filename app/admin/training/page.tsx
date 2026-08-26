import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Authoring lives in Client Services → Training. */
export default function AdminTrainingRedirect() {
  redirect('/client-services/training')
}

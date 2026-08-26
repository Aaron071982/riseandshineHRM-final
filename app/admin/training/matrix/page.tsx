import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AdminTrainingMatrixRedirect() {
  redirect('/client-services/training/matrix')
}

import { redirect } from 'next/navigation'

/** Legacy or bookmarked URL: send RBTs to dashboard. */
export default function RBTWelcomePage() {
  redirect('/rbt/dashboard')
}

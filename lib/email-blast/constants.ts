export const BT_FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdLsWRhhX92_-IwJgIGyo7HXzMcrwlCx0fVsx3EvJgfsHSb-Q/viewform'

/** Client-safe campaign metadata (no Prisma / server imports). */
export const BT_THANK_YOU_CAMPAIGN = {
  slug: 'bt-active-delivery-thank-you',
  title: 'Thank You — Actively Working BTs',
  subject: 'Thank you — and an opportunity to grow with us',
  description:
    'One-time thank-you email to all actively working BTs (ACTIVE_DELIVERY), with feedback form link and RBT certification encouragement.',
} as const

export type EmailBlastRecipient = {
  id: string
  firstName: string
  lastName: string
  email: string
}

/** Resend-friendly batching: 5 emails, then pause. */
export const EMAIL_BLAST_BATCH_SIZE = 5
export const EMAIL_BLAST_BATCH_DELAY_MS = 600
/** Sequential delay when retrying failed sends (stay under ~2/sec). */
export const EMAIL_BLAST_RETRY_DELAY_MS = 600

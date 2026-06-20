import { PostHireStage } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const BT_FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdLsWRhhX92_-IwJgIGyo7HXzMcrwlCx0fVsx3EvJgfsHSb-Q/viewform'

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

function isValidEmail(email: string | null | undefined): email is string {
  if (!email) return false
  const trimmed = email.trim()
  return trimmed.includes('@') && trimmed.length > 3
}

export async function listActiveDeliveryBlastRecipients(): Promise<EmailBlastRecipient[]> {
  const rows = await prisma.rBTProfile.findMany({
    where: {
      postHireStage: PostHireStage.ACTIVE_DELIVERY,
      email: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return rows
    .filter((r) => isValidEmail(r.email))
    .map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email!.trim().toLowerCase(),
    }))
}

export async function ensureEmailBlastCampaign(slug: string) {
  const def =
    slug === BT_THANK_YOU_CAMPAIGN.slug
      ? BT_THANK_YOU_CAMPAIGN
      : null
  if (!def) throw new Error('Unknown email blast campaign')

  return prisma.emailBlastCampaign.upsert({
    where: { slug },
    create: {
      slug: def.slug,
      title: def.title,
      subject: def.subject,
    },
    update: {
      title: def.title,
      subject: def.subject,
    },
  })
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Resend-friendly batching: 5 emails, then pause. */
export const EMAIL_BLAST_BATCH_SIZE = 5
export const EMAIL_BLAST_BATCH_DELAY_MS = 600

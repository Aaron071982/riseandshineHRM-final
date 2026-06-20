import { PostHireStage } from '@prisma/client'
import {
  BT_THANK_YOU_CAMPAIGN,
  type EmailBlastRecipient,
} from '@/lib/email-blast/constants'
import { prisma } from '@/lib/prisma'

export {
  BT_FEEDBACK_FORM_URL,
  BT_THANK_YOU_CAMPAIGN,
  EMAIL_BLAST_BATCH_DELAY_MS,
  EMAIL_BLAST_BATCH_SIZE,
  type EmailBlastRecipient,
} from '@/lib/email-blast/constants'

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
  const def = slug === BT_THANK_YOU_CAMPAIGN.slug ? BT_THANK_YOU_CAMPAIGN : null
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

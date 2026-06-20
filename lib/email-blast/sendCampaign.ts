import { EmailBlastSendStatus } from '@prisma/client'
import { sendGenericEmail } from '@/lib/email/core'
import { generateBtThankYouEmail } from '@/lib/email/generators'
import {
  BT_THANK_YOU_CAMPAIGN,
  EMAIL_BLAST_BATCH_DELAY_MS,
  EMAIL_BLAST_BATCH_SIZE,
  ensureEmailBlastCampaign,
  listActiveDeliveryBlastRecipients,
  sleep,
  type EmailBlastRecipient,
} from '@/lib/email-blast/campaigns'
import { prisma } from '@/lib/prisma'

export type EmailBlastPreview = {
  slug: string
  title: string
  subject: string
  description: string
  recipientCount: number
  recipientsSample: EmailBlastRecipient[]
  htmlPreview: string
  alreadySent: boolean
  completedAt: string | null
  sentByName: string | null
  successCount: number | null
  failureCount: number | null
  resendConfigured: boolean
  adminEmail: string | null
}

export async function getEmailBlastPreview(slug: string): Promise<EmailBlastPreview> {
  if (slug !== BT_THANK_YOU_CAMPAIGN.slug) {
    throw new Error('Unknown email blast campaign')
  }

  const [campaign, recipients] = await Promise.all([
    ensureEmailBlastCampaign(slug),
    listActiveDeliveryBlastRecipients(),
  ])

  const sample = recipients[0]
  const { html } = generateBtThankYouEmail(sample?.firstName ?? 'Alex')

  let sentByName: string | null = null
  if (campaign.sentByUserId) {
    const sender = await prisma.user.findUnique({
      where: { id: campaign.sentByUserId },
      select: { name: true, email: true },
    })
    sentByName = sender?.name?.trim() || sender?.email || null
  }

  return {
    slug: campaign.slug,
    title: campaign.title,
    subject: campaign.subject,
    description: BT_THANK_YOU_CAMPAIGN.description,
    recipientCount: recipients.length,
    recipientsSample: recipients.slice(0, 15),
    htmlPreview: html,
    alreadySent: !!campaign.completedAt,
    completedAt: campaign.completedAt?.toISOString() ?? null,
    sentByName,
    successCount: campaign.successCount,
    failureCount: campaign.failureCount,
    resendConfigured: !!process.env.RESEND_API_KEY,
    adminEmail: null,
  }
}

export type EmailBlastSendResult = {
  success: boolean
  message: string
  recipientCount: number
  successCount: number
  failureCount: number
  failures: { email: string; error: string }[]
}

export async function sendEmailBlastCampaign(
  slug: string,
  sentByUserId: string
): Promise<EmailBlastSendResult> {
  if (slug !== BT_THANK_YOU_CAMPAIGN.slug) {
    throw new Error('Unknown email blast campaign')
  }

  const campaign = await ensureEmailBlastCampaign(slug)
  if (campaign.completedAt) {
    return {
      success: false,
      message: `This campaign was already sent on ${campaign.completedAt.toLocaleString()}.`,
      recipientCount: campaign.recipientCount ?? 0,
      successCount: campaign.successCount ?? 0,
      failureCount: campaign.failureCount ?? 0,
      failures: [],
    }
  }

  const recipients = await listActiveDeliveryBlastRecipients()
  if (recipients.length === 0) {
    return {
      success: false,
      message: 'No actively working BTs with valid email addresses found.',
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
    }
  }

  const alreadySent = await prisma.emailBlastSendLog.findMany({
    where: { campaignId: campaign.id, status: EmailBlastSendStatus.SENT },
    select: { rbtProfileId: true },
  })
  const sentIds = new Set(alreadySent.map((l) => l.rbtProfileId).filter(Boolean))
  const pending = recipients.filter((r) => !sentIds.has(r.id))

  if (pending.length === 0 && alreadySent.length > 0) {
    await prisma.emailBlastCampaign.update({
      where: { id: campaign.id },
      data: {
        completedAt: campaign.completedAt ?? new Date(),
        sentByUserId: campaign.sentByUserId ?? sentByUserId,
        recipientCount: recipients.length,
        successCount: alreadySent.length,
      },
    })
    return {
      success: false,
      message: 'All recipients were already sent this campaign.',
      recipientCount: recipients.length,
      successCount: alreadySent.length,
      failureCount: campaign.failureCount ?? 0,
      failures: [],
    }
  }

  let successCount = alreadySent.length
  let failureCount = campaign.failureCount ?? 0
  const failures: { email: string; error: string }[] = []

  for (let i = 0; i < pending.length; i += EMAIL_BLAST_BATCH_SIZE) {
    const batch = pending.slice(i, i + EMAIL_BLAST_BATCH_SIZE)
    await Promise.all(
      batch.map(async (recipient) => {
        const { subject, html } = generateBtThankYouEmail(recipient.firstName)
        let status: EmailBlastSendStatus = EmailBlastSendStatus.SENT
        let errorMessage: string | null = null

        try {
          const sent = await sendGenericEmail(recipient.email, subject, html)
          if (!sent) {
            status = EmailBlastSendStatus.FAILED
            errorMessage = 'Email provider returned failure'
            failureCount += 1
            failures.push({ email: recipient.email, error: errorMessage })
          } else {
            successCount += 1
          }
        } catch (err) {
          status = EmailBlastSendStatus.FAILED
          errorMessage = err instanceof Error ? err.message : 'Send failed'
          failureCount += 1
          failures.push({ email: recipient.email, error: errorMessage })
        }

        await prisma.emailBlastSendLog.upsert({
          where: {
            campaignId_rbtProfileId: {
              campaignId: campaign.id,
              rbtProfileId: recipient.id,
            },
          },
          create: {
            campaignId: campaign.id,
            rbtProfileId: recipient.id,
            email: recipient.email,
            status,
            errorMessage,
          },
          update: {
            email: recipient.email,
            status,
            errorMessage,
            sentAt: new Date(),
          },
        })
      })
    )

    if (i + EMAIL_BLAST_BATCH_SIZE < pending.length) {
      await sleep(EMAIL_BLAST_BATCH_DELAY_MS)
    }
  }

  await prisma.emailBlastCampaign.update({
    where: { id: campaign.id },
    data: {
      completedAt: new Date(),
      sentByUserId,
      recipientCount: recipients.length,
      successCount,
      failureCount,
    },
  })

  return {
    success: true,
    message: `Sent to ${successCount} of ${recipients.length} actively working BT(s).`,
    recipientCount: recipients.length,
    successCount,
    failureCount,
    failures: failures.slice(0, 20),
  }
}

/** Send a single preview email to the logged-in admin (does not mark campaign complete). */
export async function sendEmailBlastTest(
  slug: string,
  adminEmail: string,
  adminFirstName?: string | null
): Promise<{ success: boolean; message: string }> {
  if (slug !== BT_THANK_YOU_CAMPAIGN.slug) {
    throw new Error('Unknown email blast campaign')
  }
  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      message: 'RESEND_API_KEY is not configured — emails cannot be sent from this environment.',
    }
  }

  const email = adminEmail.trim().toLowerCase()
  if (!email.includes('@')) {
    return { success: false, message: 'Your admin account has no valid email address.' }
  }

  const firstName = adminFirstName?.trim() || email.split('@')[0] || 'there'
  const { subject, html } = generateBtThankYouEmail(firstName)
  const sent = await sendGenericEmail(email, `[TEST] ${subject}`, html)

  if (!sent) {
    return { success: false, message: 'Resend rejected the test email. Check Vercel logs.' }
  }

  return {
    success: true,
    message: `Test email sent to ${email}. Check your inbox and Resend dashboard.`,
  }
}

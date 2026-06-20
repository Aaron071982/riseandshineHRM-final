import { EmailBlastSendStatus } from '@prisma/client'
import { sendGenericEmail } from '@/lib/email/core'
import { generateBtThankYouEmail } from '@/lib/email/generators'
import {
  BT_THANK_YOU_CAMPAIGN,
  EMAIL_BLAST_BATCH_DELAY_MS,
  EMAIL_BLAST_BATCH_SIZE,
  EMAIL_BLAST_RETRY_DELAY_MS,
  ensureEmailBlastCampaign,
  listActiveDeliveryBlastRecipients,
  sleep,
  type EmailBlastRecipient,
} from '@/lib/email-blast/campaigns'
import { prisma } from '@/lib/prisma'

export type FailedBlastRecipient = {
  id: string
  firstName: string
  lastName: string
  email: string
  errorMessage: string | null
}

export type EmailBlastPreview = {
  slug: string
  title: string
  subject: string
  description: string
  recipientCount: number
  recipientsSample: EmailBlastRecipient[]
  failedRecipients: FailedBlastRecipient[]
  htmlPreview: string
  alreadySent: boolean
  completedAt: string | null
  sentByName: string | null
  successCount: number | null
  failureCount: number | null
  resendConfigured: boolean
  adminEmail: string | null
}

async function writeSendLog(
  campaignId: string,
  recipient: EmailBlastRecipient,
  status: EmailBlastSendStatus,
  errorMessage: string | null
): Promise<void> {
  await prisma.emailBlastSendLog.upsert({
    where: {
      campaignId_rbtProfileId: {
        campaignId,
        rbtProfileId: recipient.id,
      },
    },
    create: {
      campaignId,
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
}

async function deliverBlastEmail(recipient: EmailBlastRecipient): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = generateBtThankYouEmail(recipient.firstName)
  try {
    const sent = await sendGenericEmail(recipient.email, subject, html)
    if (!sent) return { ok: false, error: 'Email provider returned failure' }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Send failed' }
  }
}

async function syncCampaignCounts(campaignId: string): Promise<{ successCount: number; failureCount: number }> {
  const grouped = await prisma.emailBlastSendLog.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { id: true },
  })
  const successCount = grouped.find((g) => g.status === EmailBlastSendStatus.SENT)?._count.id ?? 0
  const failureCount = grouped.find((g) => g.status === EmailBlastSendStatus.FAILED)?._count.id ?? 0
  await prisma.emailBlastCampaign.update({
    where: { id: campaignId },
    data: { successCount, failureCount },
  })
  return { successCount, failureCount }
}

async function listFailedRecipients(campaignId: string): Promise<FailedBlastRecipient[]> {
  const logs = await prisma.emailBlastSendLog.findMany({
    where: { campaignId, status: EmailBlastSendStatus.FAILED },
    include: {
      rbtProfile: { select: { firstName: true, lastName: true } },
    },
    orderBy: { email: 'asc' },
  })

  return logs.map((log) => ({
    id: log.rbtProfileId ?? log.id,
    firstName: log.rbtProfile?.firstName ?? '',
    lastName: log.rbtProfile?.lastName ?? '',
    email: log.email,
    errorMessage: log.errorMessage,
  }))
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
  const failedRecipients = campaign.completedAt ? await listFailedRecipients(campaign.id) : []

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
    failedRecipients,
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

  const failures: { email: string; error: string }[] = []

  for (let i = 0; i < pending.length; i += EMAIL_BLAST_BATCH_SIZE) {
    const batch = pending.slice(i, i + EMAIL_BLAST_BATCH_SIZE)
    for (const recipient of batch) {
      const result = await deliverBlastEmail(recipient)
      if (result.ok) {
        await writeSendLog(campaign.id, recipient, EmailBlastSendStatus.SENT, null)
      } else {
        const errorMessage = result.error ?? 'Send failed'
        failures.push({ email: recipient.email, error: errorMessage })
        await writeSendLog(campaign.id, recipient, EmailBlastSendStatus.FAILED, errorMessage)
      }
      await sleep(EMAIL_BLAST_RETRY_DELAY_MS)
    }

    if (i + EMAIL_BLAST_BATCH_SIZE < pending.length) {
      await sleep(EMAIL_BLAST_BATCH_DELAY_MS)
    }
  }

  const { successCount, failureCount } = await syncCampaignCounts(campaign.id)

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

export async function retryFailedEmailBlastCampaign(
  slug: string,
  _sentByUserId: string
): Promise<EmailBlastSendResult> {
  if (slug !== BT_THANK_YOU_CAMPAIGN.slug) {
    throw new Error('Unknown email blast campaign')
  }

  const campaign = await ensureEmailBlastCampaign(slug)
  if (!campaign.completedAt) {
    return {
      success: false,
      message: 'Campaign has not been sent yet. Use the main send button first.',
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
    }
  }

  const failedLogs = await prisma.emailBlastSendLog.findMany({
    where: { campaignId: campaign.id, status: EmailBlastSendStatus.FAILED },
    include: {
      rbtProfile: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { email: 'asc' },
  })

  if (failedLogs.length === 0) {
    return {
      success: true,
      message: 'No failed recipients to retry.',
      recipientCount: campaign.recipientCount ?? 0,
      successCount: campaign.successCount ?? 0,
      failureCount: 0,
      failures: [],
    }
  }

  const failures: { email: string; error: string }[] = []
  let retried = 0
  let newlySent = 0

  for (const log of failedLogs) {
    const profile = log.rbtProfile
    if (!profile?.id || !profile.email) continue

    const recipient: EmailBlastRecipient = {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: log.email.trim().toLowerCase(),
    }

    retried += 1
    const result = await deliverBlastEmail(recipient)
    if (result.ok) {
      newlySent += 1
      await writeSendLog(campaign.id, recipient, EmailBlastSendStatus.SENT, null)
    } else {
      const errorMessage = result.error ?? 'Send failed'
      failures.push({ email: recipient.email, error: errorMessage })
      await writeSendLog(campaign.id, recipient, EmailBlastSendStatus.FAILED, errorMessage)
    }

    await sleep(EMAIL_BLAST_RETRY_DELAY_MS)
  }

  const { successCount, failureCount } = await syncCampaignCounts(campaign.id)

  return {
    success: failureCount === 0,
    message:
      failureCount === 0
        ? `Retry complete — all ${successCount} recipients now delivered.`
        : `Retry sent ${newlySent} of ${retried} failed recipient(s). ${failureCount} still failing.`,
    recipientCount: campaign.recipientCount ?? retried,
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

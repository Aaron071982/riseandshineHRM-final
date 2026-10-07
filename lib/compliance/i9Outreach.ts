import { EmailBlastSendStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendGenericEmail } from '@/lib/email/core'
import { makePublicUrl } from '@/lib/baseUrl'
import { RBT_I9_PORTAL_PATH } from '@/lib/onboarding/catalog'
import { isOtpTestAccount } from '@/lib/constants'
import {
  EMAIL_BLAST_BATCH_DELAY_MS,
  EMAIL_BLAST_BATCH_SIZE,
  EMAIL_BLAST_RETRY_DELAY_MS,
  type EmailBlastRecipient,
} from '@/lib/email-blast/constants'
import { currentlyEmployedWhere, i9MissingWhere } from '@/lib/compliance/i9Status'
import {
  I9_COLLECTION_REMINDER_SUBJECT,
  I9_COLLECTION_REQUEST_SUBJECT,
  dueI9Reminder,
  generateI9CollectionReminderEmail,
  generateI9CollectionRequestEmail,
  i9DueDateFrom,
} from '@/lib/compliance/i9OutreachEmails'

export const I9_OUTREACH_CAMPAIGNS = {
  request: {
    slug: 'i9-collection-request',
    title: 'Form I-9 collection request',
    subject: I9_COLLECTION_REQUEST_SUBJECT,
  },
  day3: {
    slug: 'i9-collection-reminder-day3',
    title: 'Form I-9 reminder (day 3)',
    subject: I9_COLLECTION_REMINDER_SUBJECT,
  },
  day7: {
    slug: 'i9-collection-reminder-day7',
    title: 'Form I-9 reminder (day 7)',
    subject: I9_COLLECTION_REMINDER_SUBJECT,
  },
} as const

type CampaignDef = (typeof I9_OUTREACH_CAMPAIGNS)[keyof typeof I9_OUTREACH_CAMPAIGNS]

function ensureCampaign(def: CampaignDef) {
  return prisma.emailBlastCampaign.upsert({
    where: { slug: def.slug },
    create: { slug: def.slug, title: def.title, subject: def.subject },
    update: {},
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function i9TaskLink(): string {
  return makePublicUrl(RBT_I9_PORTAL_PATH)
}

/** Test profiles that sit in HIRED status but are not real employees. */
const I9_OUTREACH_EXCLUDED_EMAILS = new Set(['bluealt66@gmail.com', 'test@test.com'])

function isExcludedEmail(email: string): boolean {
  const e = email.trim().toLowerCase()
  return !e.includes('@') || I9_OUTREACH_EXCLUDED_EMAILS.has(e) || isOtpTestAccount(e)
}

/** Hired, currently employed staff with no Form I-9 on file and a usable email address. */
export async function listI9OutreachRecipients(now = new Date()): Promise<EmailBlastRecipient[]> {
  const rows = await prisma.rBTProfile.findMany({
    where: { AND: [currentlyEmployedWhere(now), i9MissingWhere, { email: { not: null } }] },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  return rows
    .filter((r) => !isExcludedEmail(r.email ?? ''))
    .map((r) => ({
      id: r.id,
      firstName: r.firstName.trim(),
      lastName: r.lastName.trim(),
      email: r.email!.trim().toLowerCase(),
    }))
}

async function sentLogsByProfile(campaignId: string) {
  const logs = await prisma.emailBlastSendLog.findMany({
    where: { campaignId, status: EmailBlastSendStatus.SENT, rbtProfileId: { not: null } },
    select: { rbtProfileId: true, sentAt: true },
  })
  return new Map(logs.map((l) => [l.rbtProfileId!, l.sentAt]))
}

async function writeSendLog(
  campaignId: string,
  recipient: EmailBlastRecipient,
  status: EmailBlastSendStatus,
  errorMessage: string | null
) {
  await prisma.emailBlastSendLog.upsert({
    where: { campaignId_rbtProfileId: { campaignId, rbtProfileId: recipient.id } },
    create: { campaignId, rbtProfileId: recipient.id, email: recipient.email, status, errorMessage },
    update: { email: recipient.email, status, errorMessage, sentAt: new Date() },
  })
}

async function syncCampaignCounts(campaignId: string, sentByUserId: string | null) {
  const grouped = await prisma.emailBlastSendLog.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { id: true },
  })
  const successCount = grouped.find((g) => g.status === EmailBlastSendStatus.SENT)?._count.id ?? 0
  const failureCount = grouped.find((g) => g.status === EmailBlastSendStatus.FAILED)?._count.id ?? 0
  const campaign = await prisma.emailBlastCampaign.findUniqueOrThrow({ where: { id: campaignId } })
  await prisma.emailBlastCampaign.update({
    where: { id: campaignId },
    data: {
      successCount,
      failureCount,
      recipientCount: successCount + failureCount,
      completedAt: campaign.completedAt ?? (successCount > 0 ? new Date() : null),
      sentByUserId: campaign.sentByUserId ?? sentByUserId,
    },
  })
  return { successCount, failureCount }
}

type Delivery = { recipient: EmailBlastRecipient; subject: string; html: string }

async function deliverAll(campaignId: string, deliveries: Delivery[]) {
  const failures: { email: string; error: string }[] = []
  let sent = 0
  for (let i = 0; i < deliveries.length; i += EMAIL_BLAST_BATCH_SIZE) {
    for (const { recipient, subject, html } of deliveries.slice(i, i + EMAIL_BLAST_BATCH_SIZE)) {
      let error: string | null = null
      try {
        if (!(await sendGenericEmail(recipient.email, subject, html))) {
          error = 'Email provider returned failure'
        }
      } catch (e) {
        error = e instanceof Error ? e.message : 'Send failed'
      }
      if (error) failures.push({ email: recipient.email, error })
      else sent++
      await writeSendLog(
        campaignId,
        recipient,
        error ? EmailBlastSendStatus.FAILED : EmailBlastSendStatus.SENT,
        error
      )
      await sleep(EMAIL_BLAST_RETRY_DELAY_MS)
    }
    if (i + EMAIL_BLAST_BATCH_SIZE < deliveries.length) await sleep(EMAIL_BLAST_BATCH_DELAY_MS)
  }
  return { sent, failures }
}

export type I9OutreachSendResult = {
  success: boolean
  message: string
  sent: number
  failures: { email: string; error: string }[]
}

function resendMissing(): I9OutreachSendResult | null {
  if (process.env.RESEND_API_KEY) return null
  return {
    success: false,
    message: 'RESEND_API_KEY is not configured — emails cannot be sent from this environment.',
    sent: 0,
    failures: [],
  }
}

/**
 * Sends the initial request to every current recipient who has not already received it.
 * Safe to re-run: each person gets the initial request at most once.
 */
export async function sendI9CollectionRequest(sentByUserId: string | null): Promise<I9OutreachSendResult> {
  const blocked = resendMissing()
  if (blocked) return blocked

  const campaign = await ensureCampaign(I9_OUTREACH_CAMPAIGNS.request)
  const [recipients, alreadySent] = await Promise.all([
    listI9OutreachRecipients(),
    sentLogsByProfile(campaign.id),
  ])
  const pending = recipients.filter((r) => !alreadySent.has(r.id))
  if (pending.length === 0) {
    return { success: true, message: 'Everyone missing an I-9 has already been sent the request.', sent: 0, failures: [] }
  }

  const link = i9TaskLink()
  const dueDate = i9DueDateFrom(new Date())
  const { sent, failures } = await deliverAll(
    campaign.id,
    pending.map((recipient) => ({
      recipient,
      ...generateI9CollectionRequestEmail({ firstName: recipient.firstName, i9TaskLink: link, dueDate }),
    }))
  )
  await syncCampaignCounts(campaign.id, sentByUserId)

  return {
    success: failures.length === 0,
    message: `Sent the I-9 request to ${sent} of ${pending.length} staff.${
      failures.length ? ` ${failures.length} failed — run send again to retry them.` : ''
    }`,
    sent,
    failures: failures.slice(0, 20),
  }
}

/**
 * Day-3 and day-7 reminders, only to request recipients who still have no I-9 on file
 * and are still employed. Only the latest due reminder is sent.
 */
export async function sendDueI9Reminders(now = new Date()): Promise<I9OutreachSendResult> {
  const requestCampaign = await prisma.emailBlastCampaign.findUnique({
    where: { slug: I9_OUTREACH_CAMPAIGNS.request.slug },
  })
  if (!requestCampaign?.completedAt) {
    return { success: true, message: 'The I-9 request has not been sent yet; no reminders due.', sent: 0, failures: [] }
  }
  const blocked = resendMissing()
  if (blocked) return blocked

  const [day3, day7] = await Promise.all([
    ensureCampaign(I9_OUTREACH_CAMPAIGNS.day3),
    ensureCampaign(I9_OUTREACH_CAMPAIGNS.day7),
  ])
  const [requestSent, day3Sent, day7Sent, stillMissing] = await Promise.all([
    sentLogsByProfile(requestCampaign.id),
    sentLogsByProfile(day3.id),
    sentLogsByProfile(day7.id),
    listI9OutreachRecipients(now),
  ])

  const link = i9TaskLink()
  const byCampaign = new Map<string, Delivery[]>([
    [day3.id, []],
    [day7.id, []],
  ])
  for (const recipient of stillMissing) {
    const sentAt = requestSent.get(recipient.id)
    if (!sentAt) continue
    const due = dueI9Reminder(sentAt, now, {
      day3: day3Sent.has(recipient.id),
      day7: day7Sent.has(recipient.id),
    })
    if (!due) continue
    byCampaign.get(due === 7 ? day7.id : day3.id)!.push({
      recipient,
      ...generateI9CollectionReminderEmail({ firstName: recipient.firstName, i9TaskLink: link }),
    })
  }

  let sent = 0
  const failures: { email: string; error: string }[] = []
  for (const [campaignId, deliveries] of Array.from(byCampaign.entries())) {
    if (deliveries.length === 0) continue
    const result = await deliverAll(campaignId, deliveries)
    sent += result.sent
    failures.push(...result.failures)
    await syncCampaignCounts(campaignId, null)
  }

  return {
    success: failures.length === 0,
    message: sent || failures.length ? `Sent ${sent} I-9 reminder(s); ${failures.length} failed.` : 'No I-9 reminders due.',
    sent,
    failures: failures.slice(0, 20),
  }
}

export async function sendI9OutreachTest(
  adminEmail: string,
  firstName: string,
  kind: 'request' | 'reminder'
): Promise<{ success: boolean; message: string }> {
  const blocked = resendMissing()
  if (blocked) return { success: false, message: blocked.message }
  const { subject, html } =
    kind === 'request'
      ? generateI9CollectionRequestEmail({ firstName, i9TaskLink: i9TaskLink(), dueDate: i9DueDateFrom(new Date()) })
      : generateI9CollectionReminderEmail({ firstName, i9TaskLink: i9TaskLink() })
  const ok = await sendGenericEmail(adminEmail, `[TEST] ${subject}`, html)
  return ok
    ? { success: true, message: `Test email sent to ${adminEmail}.` }
    : { success: false, message: 'Email provider rejected the test email.' }
}

export type I9OutreachOverview = {
  recipients: (EmailBlastRecipient & { requestSentAt: string | null })[]
  pendingRequestCount: number
  requestSentCount: number
  requestFirstSentAt: string | null
  day3SentCount: number
  day7SentCount: number
  requestHtml: string
  reminderHtml: string
  i9TaskLink: string
  resendConfigured: boolean
}

export async function getI9OutreachOverview(): Promise<I9OutreachOverview> {
  const [request, day3, day7] = await Promise.all([
    ensureCampaign(I9_OUTREACH_CAMPAIGNS.request),
    ensureCampaign(I9_OUTREACH_CAMPAIGNS.day3),
    ensureCampaign(I9_OUTREACH_CAMPAIGNS.day7),
  ])
  const [recipients, requestSent, day3Sent, day7Sent] = await Promise.all([
    listI9OutreachRecipients(),
    sentLogsByProfile(request.id),
    sentLogsByProfile(day3.id),
    sentLogsByProfile(day7.id),
  ])
  const link = i9TaskLink()
  return {
    recipients: recipients.map((r) => ({
      ...r,
      requestSentAt: requestSent.get(r.id)?.toISOString() ?? null,
    })),
    pendingRequestCount: recipients.filter((r) => !requestSent.has(r.id)).length,
    requestSentCount: requestSent.size,
    requestFirstSentAt: request.completedAt?.toISOString() ?? null,
    day3SentCount: day3Sent.size,
    day7SentCount: day7Sent.size,
    requestHtml: generateI9CollectionRequestEmail({
      firstName: 'Alex',
      i9TaskLink: link,
      dueDate: i9DueDateFrom(new Date()),
    }).html,
    reminderHtml: generateI9CollectionReminderEmail({ firstName: 'Alex', i9TaskLink: link }).html,
    i9TaskLink: link,
    resendConfigured: !!process.env.RESEND_API_KEY,
  }
}

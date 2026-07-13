import { prisma } from '@/lib/prisma'
import { sendGenericEmail } from '@/lib/email'
import {
  COMPANY_DOC_TEST_EMAIL,
  isCompanyDocTestEmail,
} from '@/lib/constants'
import {
  EMAIL_BLAST_BATCH_DELAY_MS,
  EMAIL_BLAST_BATCH_SIZE,
} from '@/lib/email-blast/constants'
import type { CompanyDocumentType } from '@prisma/client'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function actionCopy(documentType: CompanyDocumentType): string {
  switch (documentType) {
    case 'ACKNOWLEDGMENT':
      return 'Please open your portal, review the document, and sign to acknowledge.'
    case 'DOWNLOAD_UPLOAD':
      return 'Please download the document, complete it, and upload your finished version.'
    case 'VIEW_ONLY':
      return 'Please review the document in your portal (no signature required).'
    default:
      return 'Please review the document in your portal.'
  }
}

export async function resolveCompanyDocRecipients(isTest: boolean): Promise<
  Array<{ id: string; firstName: string; lastName: string; email: string }>
> {
  if (isTest) {
    const profile = await prisma.rBTProfile.findFirst({
      where: {
        OR: [
          { email: { equals: COMPANY_DOC_TEST_EMAIL, mode: 'insensitive' } },
          { user: { email: { equals: COMPANY_DOC_TEST_EMAIL, mode: 'insensitive' } } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, user: { select: { email: true } } },
    })
    if (!profile) return []
    const email = (profile.email || profile.user?.email || '').trim()
    if (!email || !isCompanyDocTestEmail(email)) return []
    return [
      {
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email,
      },
    ]
  }

  const rows = await prisma.rBTProfile.findMany({
    where: {
      postHireStage: 'ACTIVE_DELIVERY',
      status: { not: 'FIRED' },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      user: { select: { email: true } },
    },
  })

  return rows
    .map((r) => {
      const email = (r.email || r.user?.email || '').trim()
      if (!email || !email.includes('@')) return null
      return {
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email,
      }
    })
    .filter((r): r is { id: string; firstName: string; lastName: string; email: string } => !!r)
}

export function buildCompanyDocEmail(opts: {
  firstName: string
  title: string
  documentType: CompanyDocumentType
  isTest: boolean
}): { subject: string; html: string } {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'https://www.riseandshinehrm.com'
  const link = `${base}/rbt/documents`
  const subject = opts.isTest
    ? `[TEST] New document from Rise & Shine: ${opts.title}`
    : `📄 New document from Rise & Shine: ${opts.title}`
  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111">
    <p>Hi ${opts.firstName},</p>
    <p><strong>New document from Rise &amp; Shine: ${opts.title}</strong> — please review in your portal.</p>
    <p>${actionCopy(opts.documentType)}</p>
    ${opts.isTest ? '<p style="color:#6b7280;font-size:13px">This is a TEST distribution — only the designated test account receives it.</p>' : ''}
    <p><a href="${link}" style="display:inline-block;background:#e36f1e;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open Documents</a></p>
    <p style="color:#6b7280;font-size:13px">Or visit: ${link}</p>
  </div>`
  return { subject, html }
}

export async function emailCompanyDocRecipients(opts: {
  recipients: Array<{ id: string; firstName: string; email: string }>
  title: string
  documentType: CompanyDocumentType
  isTest: boolean
  companyDocumentId: string
}): Promise<number> {
  let sent = 0
  const now = new Date()
  for (let i = 0; i < opts.recipients.length; i += EMAIL_BLAST_BATCH_SIZE) {
    const batch = opts.recipients.slice(i, i + EMAIL_BLAST_BATCH_SIZE)
    await Promise.all(
      batch.map(async (r) => {
        const { subject, html } = buildCompanyDocEmail({
          firstName: r.firstName,
          title: opts.title,
          documentType: opts.documentType,
          isTest: opts.isTest,
        })
        const ok = await sendGenericEmail(r.email, subject, html).catch(() => false)
        if (ok) {
          sent++
          await prisma.companyDocumentRecipient.updateMany({
            where: { companyDocumentId: opts.companyDocumentId, rbtProfileId: r.id },
            data: { emailSentAt: now },
          })
        }
      })
    )
    if (i + EMAIL_BLAST_BATCH_SIZE < opts.recipients.length) {
      await sleep(EMAIL_BLAST_BATCH_DELAY_MS)
    }
  }
  return sent
}

export function statusCounts(
  statuses: Array<{ status: string }>
): Record<'PENDING' | 'VIEWED' | 'SIGNED' | 'SUBMITTED', number> {
  const counts = { PENDING: 0, VIEWED: 0, SIGNED: 0, SUBMITTED: 0 }
  for (const s of statuses) {
    if (s.status in counts) counts[s.status as keyof typeof counts]++
  }
  return counts
}

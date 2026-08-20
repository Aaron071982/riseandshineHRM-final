import type { CommTemplate, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  auditClientAction,
  assertCanEditClient,
  CrmAccessError,
  isFullAccess,
  type CrmUser,
} from '@/lib/crm/access'
import { assertTemplateAllowedForUser } from '@/lib/crm/emails/templatePolicy'
import {
  graphEmailEnabled,
  resolveDelegatedGraphToken,
  sendMailViaGraph,
} from '@/lib/crm/emails/graphSend'
import { mailboxBlockedReason } from '@/lib/crm/emails/mailbox'
import {
  buildStaffMergeFields,
  isValidEmail,
  loadStaffEmailMergeContext,
  parseCcList,
} from '@/lib/crm/emails/mergeContext'
import { renderStaffEmail } from '@/lib/crm/emails/templates'
import {
  downloadEmailAttachment,
  type EmailAttachmentRecord,
  MAX_ATTACHMENTS,
} from '@/lib/crm/emails/attachments'
import { CRM_EMAIL_ATTACHMENTS_PREFIX } from '@/lib/constants'
import {
  isConsentLineInitialed,
  parseConsentLines,
} from '@/lib/crm/consent'

export type StaffEmailSendResult = {
  status: 'SENT' | 'SKIPPED' | 'FAILED'
  communicationId: string
  reason?: string
}

export type StaffEmailAttachmentInput = {
  id: string
  fileName: string
  sizeBytes: number
  contentType: string
  storagePath: string
}

function isDuplicateLockedStatus(status: string | null | undefined): boolean {
  return status === 'SENT' || status === 'SKIPPED'
}

function validateAttachmentRefs(
  clientId: string,
  attachments: StaffEmailAttachmentInput[]
): StaffEmailAttachmentInput[] {
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new CrmAccessError(`At most ${MAX_ATTACHMENTS} attachments allowed`, 400)
  }
  const prefix = `${CRM_EMAIL_ATTACHMENTS_PREFIX}/${clientId}/`
  for (const a of attachments) {
    if (!a.storagePath?.startsWith(prefix)) {
      throw new CrmAccessError('Invalid attachment for this client', 400)
    }
    if (!a.fileName?.trim()) {
      throw new CrmAccessError('Attachment file name required', 400)
    }
  }
  return attachments
}

async function assertCanSendStaffEmail(
  user: CrmUser,
  clientId: string
): Promise<{
  currentOwnerUserId: string | null
  caseCoordinatorUserId: string | null
}> {
  await assertCanEditClient(user, clientId)

  const client = await prisma.serviceClient.findUnique({
    where: { id: clientId },
    select: {
      currentOwnerUserId: true,
      caseCoordinatorUserId: true,
    },
  })
  if (!client) {
    throw new Error('Client not found')
  }

  if (isFullAccess(user)) return client

  const claimed =
    client.currentOwnerUserId === user.id ||
    client.caseCoordinatorUserId === user.id

  if (!claimed) {
    throw new CrmAccessError(
      'You must claim this client (or be assigned as case coordinator) before sending email',
      403
    )
  }

  return client
}

export function clientHasEmailConsent(
  consent: { lines: unknown; deletedAt: Date | null } | null | undefined
): boolean {
  if (!consent || consent.deletedAt) return false
  return isConsentLineInitialed(parseConsentLines(consent.lines), 'comm_email')
}

export async function previewStaffClientEmail(
  user: CrmUser,
  clientId: string,
  input: {
    template: CommTemplate
    subject?: string | null
    bodyHtml?: string | null
    attachments?: StaffEmailAttachmentInput[]
  }
) {
  await assertCanSendStaffEmail(user, clientId)
  assertTemplateAllowedForUser(user, input.template)

  const client = await loadStaffEmailMergeContext(clientId)
  if (!client) throw new Error('Client not found')

  const attachments = validateAttachmentRefs(clientId, input.attachments ?? [])

  const rendered = renderStaffEmail(
    input.template,
    buildStaffMergeFields(client, {
      name: user.name ?? null,
      email: user.email ?? null,
    }),
    {
      subject: input.subject ?? undefined,
      bodyHtml: input.bodyHtml ?? undefined,
      attachments: attachments.map((a) => ({
        fileName: a.fileName,
        sizeBytes: a.sizeBytes,
      })),
    }
  )
  if (!rendered) throw new Error(`No renderer for ${input.template}`)

  return {
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    to: client.parentEmail,
    emailConsentOk: clientHasEmailConsent(
      client.consent && !client.consent.deletedAt ? client.consent : null
    ),
  }
}

async function loadGraphAttachments(
  attachments: StaffEmailAttachmentInput[]
): Promise<
  { fileName: string; contentType: string; contentBytes: Buffer }[]
> {
  const out: { fileName: string; contentType: string; contentBytes: Buffer }[] =
    []
  for (const a of attachments) {
    const file = await downloadEmailAttachment(a.storagePath)
    if (!file) {
      throw new CrmAccessError(`Could not load attachment: ${a.fileName}`, 400)
    }
    out.push({
      fileName: a.fileName,
      contentType: a.contentType || file.contentType,
      contentBytes: file.bytes,
    })
  }
  return out
}

function attachmentsJsonValue(
  attachments: StaffEmailAttachmentInput[]
): Prisma.InputJsonValue | undefined {
  if (!attachments.length) return undefined
  return attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    sizeBytes: a.sizeBytes,
    contentType: a.contentType,
    storagePath: a.storagePath,
  }))
}

export async function sendStaffClientEmail(
  user: CrmUser,
  clientId: string,
  input: {
    template: CommTemplate
    subject?: string | null
    bodyHtml?: string | null
    cc?: string | null
    force?: boolean
    attachments?: StaffEmailAttachmentInput[]
  }
): Promise<StaffEmailSendResult> {
  await assertCanSendStaffEmail(user, clientId)
  assertTemplateAllowedForUser(user, input.template)

  const mailboxReason = mailboxBlockedReason(user.email)
  if (mailboxReason) {
    throw new CrmAccessError(mailboxReason, 403)
  }

  const client = await loadStaffEmailMergeContext(clientId)
  if (!client) throw new Error('Client not found')

  const to = client.parentEmail?.trim().toLowerCase()
  if (!to || !isValidEmail(to)) {
    throw new CrmAccessError('Client has no valid parent email on file', 400)
  }

  const ccList = parseCcList(input.cc)
  for (const cc of ccList) {
    if (!isValidEmail(cc)) {
      throw new CrmAccessError(`Invalid CC address: ${cc}`, 400)
    }
  }

  const attachments = validateAttachmentRefs(clientId, input.attachments ?? [])

  if (!input.force && input.template !== 'MANUAL' && !isFullAccess(user)) {
    const prior = await prisma.clientCommunication.findFirst({
      where: {
        serviceClientId: clientId,
        template: input.template,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        deletedAt: null,
      },
      orderBy: { sentAt: 'desc' },
      select: { id: true, status: true },
    })
    if (prior && isDuplicateLockedStatus(prior.status)) {
      throw new CrmAccessError(
        `This template was already ${prior.status?.toLowerCase()} for this client. Use manual resend or contact full-access staff.`,
        409
      )
    }
  }

  const rendered = renderStaffEmail(
    input.template,
    buildStaffMergeFields(client, {
      name: user.name ?? null,
      email: user.email ?? null,
    }),
    {
      subject: input.subject ?? undefined,
      bodyHtml: input.bodyHtml ?? undefined,
      attachments: attachments.map((a) => ({
        fileName: a.fileName,
        sizeBytes: a.sizeBytes,
      })),
    }
  )
  if (!rendered) throw new Error(`No renderer for ${input.template}`)

  const now = new Date()
  const ccStored = ccList.length ? ccList.join(', ') : null
  const attachJson = attachmentsJsonValue(attachments)
  const attachNames = attachments.map((a) => a.fileName).join(', ')

  if (!graphEmailEnabled()) {
    const row = await prisma.clientCommunication.create({
      data: {
        serviceClientId: clientId,
        template: input.template,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        subject: rendered.subject,
        body: rendered.html,
        ccRecipients: ccStored,
        attachmentsJson: attachJson,
        sentByUserId: user.id,
        sentAt: now,
        status: 'SKIPPED',
      },
    })

    await prisma.serviceClient.update({
      where: { id: clientId },
      data: { lastParentContactAt: now },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: attachments.length
        ? `EMAIL_SEND_SKIPPED:${input.template}:ATTACH:${attachNames}`
        : `EMAIL_SEND_SKIPPED:${input.template}`,
    })

    return {
      status: 'SKIPPED',
      communicationId: row.id,
      reason: attachments.length
        ? `GRAPH_EMAIL_ENABLED is not true — recorded without sending (attachments: ${attachNames})`
        : 'GRAPH_EMAIL_ENABLED is not true — recorded without sending',
    }
  }

  const token = await resolveDelegatedGraphToken(user.id)
  if (!token) {
    const row = await prisma.clientCommunication.create({
      data: {
        serviceClientId: clientId,
        template: input.template,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        subject: rendered.subject,
        body: rendered.html,
        ccRecipients: ccStored,
        attachmentsJson: attachJson,
        sentByUserId: user.id,
        sentAt: now,
        status: 'SKIPPED',
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: attachments.length
        ? `EMAIL_SEND_SKIPPED:${input.template}:ATTACH:${attachNames}`
        : `EMAIL_SEND_SKIPPED:${input.template}`,
    })

    return {
      status: 'SKIPPED',
      communicationId: row.id,
      reason: 'Microsoft sign-in required — no delegated Graph token',
    }
  }

  let graphAttachments: Awaited<ReturnType<typeof loadGraphAttachments>> = []
  try {
    graphAttachments = await loadGraphAttachments(attachments)
  } catch (err) {
    if (err instanceof CrmAccessError) throw err
    throw new CrmAccessError('Failed to load attachments for send', 400)
  }

  const delivery = await sendMailViaGraph({
    accessToken: token,
    fromAddress: user.email!,
    to: [to],
    cc: ccList.length ? ccList : undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments: graphAttachments,
  })

  if (!delivery.ok) {
    const row = await prisma.clientCommunication.create({
      data: {
        serviceClientId: clientId,
        template: input.template,
        channel: 'EMAIL',
        direction: 'OUTBOUND',
        subject: rendered.subject,
        body: `${rendered.html}\n\n<!-- ERROR: ${delivery.error} -->`,
        ccRecipients: ccStored,
        attachmentsJson: attachJson,
        sentByUserId: user.id,
        sentAt: now,
        status: 'FAILED',
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `EMAIL_SEND_FAILED:${input.template}`,
    })

    return {
      status: 'FAILED',
      communicationId: row.id,
      reason: delivery.error,
    }
  }

  const row = await prisma.clientCommunication.create({
    data: {
      serviceClientId: clientId,
      template: input.template,
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      subject: rendered.subject,
      body: rendered.html,
      ccRecipients: ccStored,
      attachmentsJson: attachJson,
      sentByUserId: user.id,
      sentAt: now,
      status: 'SENT',
    },
  })

  await prisma.serviceClient.update({
    where: { id: clientId },
    data: { lastParentContactAt: now },
  })

  await auditClientAction({
    userId: user.id,
    serviceClientId: clientId,
    action: attachments.length
      ? `EMAIL_SEND:${input.template}:ATTACH:${attachNames}:TO:${to}`
      : `EMAIL_SEND:${input.template}`,
  })

  return { status: 'SENT', communicationId: row.id }
}

export type { EmailAttachmentRecord }

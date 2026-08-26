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
  meetAndGreetCcEmails,
  mergeCcLists,
  parseCcList,
} from '@/lib/crm/emails/mergeContext'
import { buildMissingDocsList } from '@/lib/crm/emails/missingDocs'
import { renderStaffEmail } from '@/lib/crm/emails/templates'
import type { AssessmentModality } from '@/lib/crm/emails/templates/types'
import type { EmailLinkMeta } from '@/lib/crm/emails/templates/shell'
import {
  downloadEmailAttachment,
  type EmailAttachmentRecord,
  MAX_ATTACHMENTS,
} from '@/lib/crm/emails/attachments'
import {
  loadTemplateFormAttachments,
  templateFormAttachmentMetas,
} from '@/lib/crm/emails/templateFormAttachments'
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

export type StaffEmailLinkInput = {
  url: string
  label?: string
}

const MAX_LINKS = 5

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

function validateLinks(links: StaffEmailLinkInput[]): EmailLinkMeta[] {
  if (links.length > MAX_LINKS) {
    throw new CrmAccessError(`At most ${MAX_LINKS} links allowed`, 400)
  }
  const out: EmailLinkMeta[] = []
  for (const link of links) {
    const url = link.url?.trim()
    if (!url) continue
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new CrmAccessError('Links must use http or https', 400)
      }
    } catch (err) {
      if (err instanceof CrmAccessError) throw err
      throw new CrmAccessError(`Invalid link URL: ${url}`, 400)
    }
    out.push({ url, label: link.label?.trim() || undefined })
  }
  return out
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

function attachmentsJsonValue(
  attachments: StaffEmailAttachmentInput[],
  links: EmailLinkMeta[],
  templateForms?: { fileName: string; sizeBytes: number; contentType: string }[]
): Prisma.InputJsonValue | undefined {
  const files = [
    ...(templateForms ?? []).map((a) => ({
      id: `template:${a.fileName}`,
      fileName: a.fileName,
      sizeBytes: a.sizeBytes,
      contentType: a.contentType,
      source: 'template' as const,
    })),
    ...attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      sizeBytes: a.sizeBytes,
      contentType: a.contentType,
      storagePath: a.storagePath,
      source: 'upload' as const,
    })),
  ]
  const linkRows = links.map((l) => ({ url: l.url, label: l.label ?? null }))
  if (!files.length && !linkRows.length) return undefined
  return { files, links: linkRows }
}

function auditExtras(
  attachments: StaffEmailAttachmentInput[],
  links: EmailLinkMeta[],
  templateFormNames?: string[]
): string {
  const parts: string[] = []
  const allNames = [
    ...(templateFormNames ?? []),
    ...attachments.map((a) => a.fileName),
  ]
  if (allNames.length) {
    parts.push(`ATTACH:${allNames.join(',')}`)
  }
  if (links.length) {
    parts.push(`LINK:${links.map((l) => l.url).join(',')}`)
  }
  return parts.length ? `:${parts.join(':')}` : ''
}

function assertRbtAssignmentForClient(
  client: NonNullable<Awaited<ReturnType<typeof loadStaffEmailMergeContext>>>,
  rbtAssignmentId: string | null | undefined
): void {
  if (!rbtAssignmentId) return
  const ok = client.btAssignments.some((a) => a.id === rbtAssignmentId)
  if (!ok) {
    throw new CrmAccessError('Selected RBT is not an active staffing assignment for this client', 400)
  }
}

async function enrichMergeFieldsForTemplate(
  clientId: string,
  template: CommTemplate,
  fields: ReturnType<typeof buildStaffMergeFields>
) {
  if (template !== 'DOCS_NEEDED') return fields

  const requirements = await prisma.clientRequirement.findMany({
    where: {
      serviceClientId: clientId,
      deletedAt: null,
      type: 'DOCUMENT',
    },
    select: {
      key: true,
      label: true,
      status: true,
      expiresAt: true,
    },
  })

  return {
    ...fields,
    missingDocsList: buildMissingDocsList(requirements),
  }
}

export async function previewStaffClientEmail(
  user: CrmUser,
  clientId: string,
  input: {
    template: CommTemplate
    subject?: string | null
    bodyHtml?: string | null
    attachments?: StaffEmailAttachmentInput[]
    links?: StaffEmailLinkInput[]
    assessmentModality?: AssessmentModality | null
    rbtAssignmentId?: string | null
  }
) {
  await assertCanSendStaffEmail(user, clientId)
  assertTemplateAllowedForUser(user, input.template)

  const client = await loadStaffEmailMergeContext(clientId)
  if (!client) throw new Error('Client not found')

  assertRbtAssignmentForClient(client, input.rbtAssignmentId)

  const attachments = validateAttachmentRefs(clientId, input.attachments ?? [])
  const links = validateLinks(input.links ?? [])
  const formMetas = templateFormAttachmentMetas(input.template)
  const baseFields = buildStaffMergeFields(
    client,
    {
      name: user.name ?? null,
      email: user.email ?? null,
    },
    { rbtAssignmentId: input.rbtAssignmentId ?? null }
  )
  const fields = await enrichMergeFieldsForTemplate(
    clientId,
    input.template,
    baseFields
  )

  const rendered = renderStaffEmail(input.template, fields, {
    subject: input.subject ?? undefined,
    bodyHtml: input.bodyHtml ?? undefined,
    attachments: [
      ...formMetas,
      ...attachments.map((a) => ({
        fileName: a.fileName,
        sizeBytes: a.sizeBytes,
      })),
    ],
    links,
    assessmentModality: input.assessmentModality ?? null,
  })
  if (!rendered) throw new Error(`No renderer for ${input.template}`)

  return {
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    to: client.parentEmail,
    emailConsentOk: clientHasEmailConsent(
      client.consent && !client.consent.deletedAt ? client.consent : null
    ),
    suggestedCc:
      input.template === 'MEET_AND_GREET' ? meetAndGreetCcEmails(fields) : [],
    templateAttachments: formMetas,
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
    links?: StaffEmailLinkInput[]
    assessmentModality?: AssessmentModality | null
    rbtAssignmentId?: string | null
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

  assertRbtAssignmentForClient(client, input.rbtAssignmentId)

  const to = client.parentEmail?.trim().toLowerCase()
  if (!to || !isValidEmail(to)) {
    throw new CrmAccessError('Client has no valid parent email on file', 400)
  }

  const fields = await enrichMergeFieldsForTemplate(
    clientId,
    input.template,
    buildStaffMergeFields(
      client,
      {
        name: user.name ?? null,
        email: user.email ?? null,
      },
      { rbtAssignmentId: input.rbtAssignmentId ?? null }
    )
  )

  const autoCc =
    input.template === 'MEET_AND_GREET' ? meetAndGreetCcEmails(fields) : []
  const ccList = mergeCcLists(parseCcList(input.cc), autoCc)
  for (const cc of ccList) {
    if (!isValidEmail(cc)) {
      throw new CrmAccessError(`Invalid CC address: ${cc}`, 400)
    }
  }

  const attachments = validateAttachmentRefs(clientId, input.attachments ?? [])
  const links = validateLinks(input.links ?? [])
  const templateForms = loadTemplateFormAttachments(input.template)

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

  const rendered = renderStaffEmail(input.template, fields, {
    subject: input.subject ?? undefined,
    bodyHtml: input.bodyHtml ?? undefined,
    attachments: [
      ...templateForms.map((a) => ({
        fileName: a.fileName,
        sizeBytes: a.sizeBytes,
      })),
      ...attachments.map((a) => ({
        fileName: a.fileName,
        sizeBytes: a.sizeBytes,
      })),
    ],
    links,
    assessmentModality: input.assessmentModality ?? null,
  })
  if (!rendered) throw new Error(`No renderer for ${input.template}`)

  const now = new Date()
  const ccStored = ccList.length ? ccList.join(', ') : null
  const attachJson = attachmentsJsonValue(attachments, links, templateForms)
  const extras = auditExtras(
    attachments,
    links,
    templateForms.map((f) => f.fileName)
  )

  const recordSkipped = async (reason: string) => {
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
      action: `EMAIL_SEND_SKIPPED:${input.template}${extras}`,
    })

    return {
      status: 'SKIPPED' as const,
      communicationId: row.id,
      reason,
    }
  }

  if (!graphEmailEnabled()) {
    const detail = [
      templateForms.length || attachments.length
        ? `attachments: ${[
            ...templateForms.map((a) => a.fileName),
            ...attachments.map((a) => a.fileName),
          ].join(', ')}`
        : null,
      links.length ? `links: ${links.map((l) => l.url).join(', ')}` : null,
    ]
      .filter(Boolean)
      .join('; ')
    return recordSkipped(
      detail
        ? `GRAPH_EMAIL_ENABLED is not true — recorded without sending (${detail})`
        : 'GRAPH_EMAIL_ENABLED is not true — recorded without sending'
    )
  }

  const token = await resolveDelegatedGraphToken(user.id)
  if (!token) {
    return recordSkipped('Microsoft sign-in required — no delegated Graph token')
  }

  let graphAttachments: Awaited<ReturnType<typeof loadGraphAttachments>> = []
  try {
    const uploaded = await loadGraphAttachments(attachments)
    graphAttachments = [
      ...templateForms.map((f) => ({
        fileName: f.fileName,
        contentType: f.contentType,
        contentBytes: f.contentBytes,
      })),
      ...uploaded,
    ]
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
      action: `EMAIL_SEND_FAILED:${input.template}${extras}`,
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
    action: `EMAIL_SEND:${input.template}${extras}:TO:${to}`,
  })

  return { status: 'SENT', communicationId: row.id }
}

export type { EmailAttachmentRecord }

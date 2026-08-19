import type { CommTemplate } from '@prisma/client'
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

export type StaffEmailSendResult = {
  status: 'SENT' | 'SKIPPED' | 'FAILED'
  communicationId: string
  reason?: string
}

function isDuplicateLockedStatus(status: string | null | undefined): boolean {
  return status === 'SENT' || status === 'SKIPPED'
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

export async function previewStaffClientEmail(
  user: CrmUser,
  clientId: string,
  input: {
    template: CommTemplate
    subject?: string | null
    bodyHtml?: string | null
  }
) {
  await assertCanSendStaffEmail(user, clientId)
  assertTemplateAllowedForUser(user, input.template)

  const client = await loadStaffEmailMergeContext(clientId)
  if (!client) throw new Error('Client not found')

  const rendered = renderStaffEmail(
    input.template,
    buildStaffMergeFields(client, {
      name: user.name ?? null,
      email: user.email ?? null,
    }),
    {
      subject: input.subject ?? undefined,
      bodyHtml: input.bodyHtml ?? undefined,
    }
  )
  if (!rendered) throw new Error(`No renderer for ${input.template}`)

  return {
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    to: client.parentEmail,
  }
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
    }
  )
  if (!rendered) throw new Error(`No renderer for ${input.template}`)

  const now = new Date()
  const ccStored = ccList.length ? ccList.join(', ') : null

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
      action: `EMAIL_SEND_SKIPPED:${input.template}`,
    })

    return {
      status: 'SKIPPED',
      communicationId: row.id,
      reason: 'GRAPH_EMAIL_ENABLED is not true — recorded without sending',
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
        sentByUserId: user.id,
        sentAt: now,
        status: 'SKIPPED',
      },
    })

    await auditClientAction({
      userId: user.id,
      serviceClientId: clientId,
      action: `EMAIL_SEND_SKIPPED:${input.template}`,
    })

    return {
      status: 'SKIPPED',
      communicationId: row.id,
      reason: 'Microsoft sign-in required — no delegated Graph token',
    }
  }

  const delivery = await sendMailViaGraph({
    accessToken: token,
    fromAddress: user.email!,
    to: [to],
    cc: ccList.length ? ccList : undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
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
    action: `EMAIL_SEND:${input.template}`,
  })

  return { status: 'SENT', communicationId: row.id }
}

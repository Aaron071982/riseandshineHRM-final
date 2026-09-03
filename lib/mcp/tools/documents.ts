import 'server-only'

import { fetchUserCrmRoles } from '@/lib/crm/access'
import { NOT_DELETED } from '@/lib/crm/softDelete'
import { downloadRequirementDocument, isStoredRequirementPath } from '@/lib/crm/requirementDocuments'
import {
  DOCUMENT_READ_UNAUTHORIZED_MESSAGE,
  userCanReadClientDocuments,
} from '@/lib/mcp/documentAllowlist'
import {
  documentViewUrl,
  logDocumentAccess,
  signDocumentViewToken,
  VIEW_TOKEN_TTL_SECONDS,
} from '@/lib/mcp/documentAccess'
import {
  classifyDocumentReadableVia,
  documentTypeRefusalMessage,
} from '@/lib/mcp/documentPolicy'
import { extractDocumentText } from '@/lib/mcp/extractDocumentText'
import { jsonToolResult } from '@/lib/mcp/format'
import { requireMcpAuthContext } from '@/lib/mcp/context'
import type { ToolResult } from '@/lib/mcp/types'
import { prisma } from '@/lib/prisma'

async function resolveServiceClientId(client: string): Promise<string | null> {
  const q = client.trim()
  if (!q) return null
  const row = await prisma.serviceClient.findFirst({
    where: {
      ...NOT_DELETED,
      OR: [
        { id: q },
        { clientCode: { equals: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  })
  return row?.id ?? null
}

export async function listClientDocuments(args: {
  client: string
}): Promise<ToolResult> {
  const clientId = await resolveServiceClientId(args.client)
  if (!clientId) throw new Error(`Client not found: ${args.client}`)

  const docs = await prisma.clientRequirement.findMany({
    where: {
      serviceClientId: clientId,
      deletedAt: null,
      type: 'DOCUMENT',
      status: { in: ['RECEIVED', 'ON_FILE', 'COMPLETE'] },
      NOT: { fileUrl: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      key: true,
      label: true,
      fileName: true,
      fileContentType: true,
      completedAt: true,
      updatedAt: true,
      status: true,
    },
  })

  const listed = docs.map((d) => ({
    documentId: d.id,
    type: d.key,
    label: d.label,
    fileName: d.fileName,
    uploadedAt: (d.completedAt ?? d.updatedAt).toISOString(),
    status: d.status,
    readableVia: classifyDocumentReadableVia({ key: d.key, label: d.label }),
  }))

  return jsonToolResult(
    `On-file documents for client ${clientId}`,
    { clientId, total: listed.length, documents: listed },
    { clientId, count: listed.length }
  )
}

async function loadAllowlistedActor(): Promise<{
  allowed: boolean
  userId: string
}> {
  const auth = requireMcpAuthContext()
  const userId = auth.userId
  if (!userId) {
    return { allowed: false, userId: '' }
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, canReadClientDocuments: true },
  })
  if (!user) return { allowed: false, userId }
  const crmRoles = await fetchUserCrmRoles(user.id)
  return {
    allowed: userCanReadClientDocuments({ ...user, crmRoles }),
    userId: user.id,
  }
}

export async function readDocument(args: {
  documentId: string
  mode?: string
}): Promise<ToolResult> {
  const documentId = args.documentId?.trim()
  if (!documentId) throw new Error('documentId is required')

  const modeRaw = (args.mode ?? 'text').trim().toLowerCase()
  const mode: 'text' | 'link' = modeRaw === 'link' ? 'link' : 'text'

  const actor = await loadAllowlistedActor()
  const requirement = await prisma.clientRequirement.findFirst({
    where: { id: documentId, deletedAt: null, type: 'DOCUMENT' },
    select: {
      id: true,
      key: true,
      label: true,
      fileUrl: true,
      fileName: true,
      fileContentType: true,
      serviceClientId: true,
    },
  })

  const documentType = requirement?.key ?? 'unknown'
  const clientId = requirement?.serviceClientId ?? null

  if (!actor.allowed) {
    await logDocumentAccess({
      userId: actor.userId || undefined,
      serviceClientId: clientId,
      documentId,
      documentType,
      action: 'BLOCKED_UNAUTHORIZED',
      mode,
      reason: 'not_on_document_allowlist',
    })
    throw new Error(DOCUMENT_READ_UNAUTHORIZED_MESSAGE)
  }

  if (!requirement) {
    await logDocumentAccess({
      userId: actor.userId,
      documentId,
      documentType: 'unknown',
      action: 'BLOCKED_TYPE',
      mode,
      reason: 'document_not_found',
    })
    throw new Error('Document not found')
  }

  const readableVia = classifyDocumentReadableVia({
    key: requirement.key,
    label: requirement.label,
  })

  if (readableVia === 'blocked' || (mode === 'text' && readableVia !== 'text')) {
    await logDocumentAccess({
      userId: actor.userId,
      serviceClientId: clientId,
      documentId,
      documentType,
      action: 'BLOCKED_TYPE',
      mode,
      reason: `readableVia=${readableVia}`,
    })
    throw new Error(documentTypeRefusalMessage(readableVia === 'blocked' ? 'blocked' : 'link'))
  }

  if (!isStoredRequirementPath(requirement.fileUrl) || !requirement.fileUrl) {
    await logDocumentAccess({
      userId: actor.userId,
      serviceClientId: clientId,
      documentId,
      documentType,
      action: 'BLOCKED_TYPE',
      mode,
      reason: 'no_stored_file',
    })
    throw new Error('No uploaded file for this document. Open it in the app.')
  }

  if (mode === 'link' || readableVia === 'link') {
    const token = signDocumentViewToken({
      requirementId: requirement.id,
      userId: actor.userId,
      ttlSeconds: VIEW_TOKEN_TTL_SECONDS,
    })
    const url = documentViewUrl(token)
    await logDocumentAccess({
      userId: actor.userId,
      serviceClientId: clientId,
      documentId,
      documentType,
      action: 'LINK_ISSUED',
      mode: 'link',
    })
    return jsonToolResult(
      'Signed viewing link (expires in 5 minutes). The file contents are not included.',
      {
        documentId: requirement.id,
        type: requirement.key,
        label: requirement.label,
        mode: 'link',
        expiresInSeconds: VIEW_TOKEN_TTL_SECONDS,
        viewUrl: url,
      },
      { documentId: requirement.id, mode: 'link', documentType }
    )
  }

  const { bytes, contentType } = await downloadRequirementDocument(requirement.fileUrl)
  const extracted = await extractDocumentText({
    bytes,
    contentType: requirement.fileContentType || contentType,
    fileName: requirement.fileName,
  })
  if ('error' in extracted) {
    await logDocumentAccess({
      userId: actor.userId,
      serviceClientId: clientId,
      documentId,
      documentType,
      action: 'BLOCKED_TYPE',
      mode: 'text',
      reason: extracted.error,
    })
    throw new Error(extracted.error)
  }

  await logDocumentAccess({
    userId: actor.userId,
    serviceClientId: clientId,
    documentId,
    documentType,
    action: 'TEXT_RETURNED',
    mode: 'text',
    reason: `chars=${extracted.text.length}`,
  })

  return {
    text: `# ${requirement.label} (${requirement.key})\n\n${extracted.text}`,
    summary: {
      documentId: requirement.id,
      documentType,
      mode: 'text',
      charCount: extracted.text.length,
    },
  }
}

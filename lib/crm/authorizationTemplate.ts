import 'server-only'

import { randomUUID } from 'crypto'
import {
  CRM_CLIENT_AUTH_TEMPLATES_PREFIX,
  STORAGE_BUCKET,
} from '@/lib/constants'
import { supabaseAdmin } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import {
  assertAuthTemplateStoragePath,
  authTemplateDownloadFileName,
  isStoredAuthTemplatePath,
  validateAuthTemplateFile,
} from '@/lib/crm/authorizationTemplate.shared'

export {
  assertAuthTemplateStoragePath,
  authTemplateDownloadFileName,
  isStoredAuthTemplatePath,
  MAX_AUTH_TEMPLATE_BYTES,
  validateAuthTemplateFile,
  VERCEL_AUTH_TEMPLATE_UPLOAD_BODY_LIMIT_BYTES,
} from '@/lib/crm/authorizationTemplate.shared'

export function buildAuthTemplateStoragePath(input: {
  clientId: string
  fileName: string
}): string {
  const ext = input.fileName.split('.').pop()?.toLowerCase() || 'bin'
  const id = randomUUID()
  return `${CRM_CLIENT_AUTH_TEMPLATES_PREFIX}/${input.clientId}/${id}.${ext}`
}

export type AuthTemplateSignedUpload = {
  signedUrl: string
  token: string
  storagePath: string
  contentType: string
}

export async function createAuthTemplateSignedUpload(input: {
  clientId: string
  fileName: string
  contentType: string
}): Promise<AuthTemplateSignedUpload> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const storagePath = buildAuthTemplateStoragePath(input)
  const contentType = input.contentType || 'application/octet-stream'
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false })
  if (error || !data?.signedUrl) {
    console.error('[crm-auth-template] signed upload url failed', error)
    throw new Error(
      error?.message ||
        'Could not prepare upload — confirm the storage bucket allows files up to 25 MB'
    )
  }
  return {
    signedUrl: data.signedUrl,
    token: data.token,
    storagePath: data.path ?? storagePath,
    contentType,
  }
}

export async function authTemplateObjectExists(storagePath: string): Promise<boolean> {
  if (!supabaseAdmin) return false
  const parts = storagePath.split('/')
  const fileName = parts.pop()
  if (!fileName) return false
  const folder = parts.join('/')
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .list(folder, { search: fileName, limit: 1 })
  if (error) return false
  return (data ?? []).some((row) => row.name === fileName)
}

export async function attachAuthTemplateRecord(input: {
  clientId: string
  userId: string
  storagePath: string
  fileName: string
  contentType: string
  sizeBytes: number
}) {
  assertAuthTemplateStoragePath({
    clientId: input.clientId,
    storagePath: input.storagePath,
  })
  if (!(await authTemplateObjectExists(input.storagePath))) {
    throw new Error('Uploaded file not found in storage')
  }

  const existing = await prisma.clientAuthorizationTemplate.findFirst({
    where: { serviceClientId: input.clientId, deletedAt: null },
    select: { id: true },
  })
  if (existing) {
    await prisma.clientAuthorizationTemplate.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        deletedByUserId: input.userId,
      },
    })
  }

  return prisma.clientAuthorizationTemplate.create({
    data: {
      serviceClientId: input.clientId,
      fileName: input.fileName,
      storagePath: input.storagePath,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      uploadedByUserId: input.userId,
    },
  })
}

export async function downloadAuthTemplateDocument(storagePath: string): Promise<{
  bytes: Buffer
  contentType: string
}> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  if (!isStoredAuthTemplatePath(storagePath)) {
    throw new Error('Invalid template storage path')
  }
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(storagePath)
  if (error || !data) {
    console.error('[crm-auth-template] download failed', error)
    throw new Error('Download failed')
  }
  const arrayBuffer = await data.arrayBuffer()
  return {
    bytes: Buffer.from(arrayBuffer),
    contentType: data.type || 'application/octet-stream',
  }
}

export async function createAuthTemplatePreviewSignedUrl(
  storagePath: string
): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 120)
  if (error || !data?.signedUrl) {
    throw new Error('Could not create preview URL')
  }
  return data.signedUrl
}

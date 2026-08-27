import 'server-only'

import { randomUUID } from 'crypto'
import {
  CRM_CLIENT_REQUIREMENTS_PREFIX,
  STORAGE_BUCKET,
} from '@/lib/constants'
import { supabaseAdmin } from '@/lib/supabase'
import { computeExpiresAt } from '@/lib/crm/documents'
import { prisma } from '@/lib/prisma'
import {
  assertRequirementStoragePath,
} from '@/lib/crm/requirementDocuments.shared'

export {
  assertRequirementStoragePath,
  isStoredRequirementPath,
  isUploadableDocumentRequirement,
  MAX_REQUIREMENT_DOCUMENT_BYTES,
  requirementDownloadFileName,
  validateRequirementDocumentFile,
  VERCEL_UPLOAD_BODY_LIMIT_BYTES,
  type RequirementUploadRequirement,
} from '@/lib/crm/requirementDocuments.shared'

export function buildRequirementStoragePath(input: {
  clientId: string
  requirementKey: string
  fileName: string
}): string {
  const ext = input.fileName.split('.').pop()?.toLowerCase() || 'bin'
  const safeKey = input.requirementKey.replace(/[^a-z0-9_-]/gi, '_')
  const id = randomUUID()
  return `${CRM_CLIENT_REQUIREMENTS_PREFIX}/${input.clientId}/${safeKey}-${id}.${ext}`
}

export async function uploadRequirementDocument(input: {
  clientId: string
  requirementKey: string
  fileName: string
  contentType: string
  bytes: Buffer
}): Promise<{
  storagePath: string
  fileName: string
  contentType: string
  sizeBytes: number
}> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const storagePath = buildRequirementStoragePath(input)
  const contentType = input.contentType || 'application/octet-stream'
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType,
      upsert: false,
    })
  if (error) {
    console.error('[crm-requirements] upload failed', error)
    throw new Error('Upload failed')
  }
  return {
    storagePath,
    fileName: input.fileName,
    contentType,
    sizeBytes: input.bytes.length,
  }
}

export type RequirementSignedUpload = {
  signedUrl: string
  token: string
  storagePath: string
  contentType: string
}

/** Issue a short-lived signed URL so the browser can PUT bytes directly to Supabase. */
export async function createRequirementSignedUpload(input: {
  clientId: string
  requirementKey: string
  fileName: string
  contentType: string
}): Promise<RequirementSignedUpload> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const storagePath = buildRequirementStoragePath(input)
  const contentType = input.contentType || 'application/octet-stream'
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false })
  if (error || !data?.signedUrl) {
    console.error('[crm-requirements] signed upload url failed', error)
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

export async function requirementObjectExists(storagePath: string): Promise<boolean> {
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

export async function attachRequirementDocumentRecord(input: {
  requirementId: string
  clientId: string
  userId: string
  requirementKey: string
  storagePath: string
  fileName: string
  contentType: string
  sizeBytes: number
}) {
  const pathCheck = assertRequirementStoragePath(
    input.storagePath,
    input.clientId,
    input.requirementKey
  )
  if (!pathCheck.ok) {
    throw new Error(pathCheck.error)
  }

  const exists = await requirementObjectExists(input.storagePath)
  if (!exists) {
    throw new Error('Uploaded file not found in storage — try uploading again')
  }

  const now = new Date()
  return prisma.clientRequirement.update({
    where: { id: input.requirementId },
    data: {
      status: 'RECEIVED',
      fileUrl: input.storagePath,
      fileName: input.fileName,
      fileContentType: input.contentType,
      fileSizeBytes: input.sizeBytes,
      completedAt: now,
      completedByUserId: input.userId,
      attestedAt: null,
      attestedByUserId: null,
      expiresAt: computeExpiresAt(input.requirementKey, now),
    },
    select: {
      id: true,
      key: true,
      label: true,
      status: true,
      fileName: true,
      fileSizeBytes: true,
      completedAt: true,
    },
  })
}

export async function downloadRequirementDocument(
  storagePath: string
): Promise<{ bytes: Buffer; contentType: string }> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(storagePath.trim())
  if (error || !data) {
    console.error('[crm-requirements] download failed', error)
    throw new Error('Download failed')
  }
  const bytes = Buffer.from(await data.arrayBuffer())
  return {
    bytes,
    contentType: data.type || 'application/octet-stream',
  }
}

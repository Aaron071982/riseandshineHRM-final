import 'server-only'

import { ASSESSMENT_FILES_BUCKET } from '@/lib/constants'
import { supabaseAdmin } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import {
  assertAssessmentStoragePath,
  validateAssessmentFile,
} from '@/lib/crm/assessment/attachments.shared'
import { buildAssessmentStoragePath } from '@/lib/crm/assessment/storagePaths'

export {
  assertAssessmentStoragePath,
  MAX_ASSESSMENT_FILE_BYTES,
  parseAssessmentAttachmentKind,
  validateAssessmentFile,
} from '@/lib/crm/assessment/attachments.shared'

export type AssessmentSignedUpload = {
  signedUrl: string
  token: string
  storagePath: string
  contentType: string
}

export async function createAssessmentSignedUpload(input: {
  serviceClientId: string
  assessmentId: string
  sectionKey: string
  fileName: string
  contentType: string
  kind: 'IMAGE' | 'PDF'
}): Promise<AssessmentSignedUpload> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }

  const storagePath = buildAssessmentStoragePath({
    serviceClientId: input.serviceClientId,
    assessmentId: input.assessmentId,
    sectionKey: input.sectionKey,
    fileName: input.fileName,
  })
  const contentType = input.contentType || 'application/octet-stream'

  const { data, error } = await supabaseAdmin.storage
    .from(ASSESSMENT_FILES_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false })

  if (error || !data?.signedUrl) {
    console.error('[treatment-assessment] signed upload url failed', error)
    throw new Error('Could not prepare upload')
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    storagePath: data.path ?? storagePath,
    contentType,
  }
}

export async function assessmentObjectExists(storagePath: string): Promise<boolean> {
  if (!supabaseAdmin) return false
  const parts = storagePath.split('/')
  const fileName = parts.pop()
  if (!fileName) return false
  const folder = parts.join('/')
  const { data, error } = await supabaseAdmin.storage
    .from(ASSESSMENT_FILES_BUCKET)
    .list(folder, { search: fileName, limit: 1 })
  if (error) return false
  return (data ?? []).some((row) => row.name === fileName)
}

export async function downloadAssessmentFile(
  storagePath: string
): Promise<{ bytes: Buffer; contentType: string }> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const { data, error } = await supabaseAdmin.storage
    .from(ASSESSMENT_FILES_BUCKET)
    .download(storagePath)
  if (error || !data) {
    console.error('[treatment-assessment] download failed', error)
    throw new Error('Download failed')
  }
  const arrayBuffer = await data.arrayBuffer()
  return {
    bytes: Buffer.from(arrayBuffer),
    contentType: data.type || 'application/octet-stream',
  }
}

export async function createAssessmentAttachmentRecord(input: {
  assessmentId: string
  serviceClientId: string
  userId: string
  sectionKey: string
  kind: 'IMAGE' | 'PDF'
  storagePath: string
  fileName: string
  mimeType: string
  sizeBytes: number
}) {
  assertAssessmentStoragePath({
    serviceClientId: input.serviceClientId,
    assessmentId: input.assessmentId,
    storagePath: input.storagePath,
  })

  if (!(await assessmentObjectExists(input.storagePath))) {
    throw new Error('Uploaded file not found in storage')
  }

  const assessment = await prisma.clientTreatmentAssessment.findFirst({
    where: {
      id: input.assessmentId,
      serviceClientId: input.serviceClientId,
      deletedAt: null,
    },
    select: { id: true, status: true },
  })
  if (!assessment) {
    throw new Error('Assessment not found')
  }
  if (assessment.status === 'SIGNED') {
    throw new Error('Signed assessments cannot be modified')
  }

  return prisma.clientTreatmentAssessmentAttachment.create({
    data: {
      assessmentId: input.assessmentId,
      sectionKey: input.sectionKey,
      kind: input.kind,
      storagePath: input.storagePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedByUserId: input.userId,
    },
  })
}

export async function createAssessmentFileSignedUrl(
  storagePath: string,
  ttlSeconds = 120
): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const { data, error } = await supabaseAdmin.storage
    .from(ASSESSMENT_FILES_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds)
  if (error || !data?.signedUrl) {
    throw new Error('Could not sign file URL')
  }
  return data.signedUrl
}

export async function softDeleteAssessmentAttachment(input: {
  attachmentId: string
  assessmentId: string
  serviceClientId: string
  userId: string
}) {
  const attachment = await prisma.clientTreatmentAssessmentAttachment.findFirst({
    where: {
      id: input.attachmentId,
      assessmentId: input.assessmentId,
      deletedAt: null,
      assessment: {
        serviceClientId: input.serviceClientId,
        deletedAt: null,
        status: { not: 'SIGNED' },
      },
    },
  })
  if (!attachment) {
    throw new Error('Attachment not found')
  }

  return prisma.clientTreatmentAssessmentAttachment.update({
    where: { id: attachment.id },
    data: { deletedAt: new Date() },
  })
}

import 'server-only'

import { randomUUID } from 'crypto'
import { CRM_CLINICAL_ASSESSMENTS_PREFIX, STORAGE_BUCKET } from '@/lib/constants'
import { supabaseAdmin } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import {
  assertClinicalAssessmentStoragePath,
  isStoredClinicalAssessmentPath,
  missingAssessmentArtifactTypes,
  validateClinicalAssessmentFile,
} from '@/lib/crm/clinicalAssessment/artifacts.shared'
import { ensureAssessmentDetailsForAssessment } from '@/lib/crm/clinicalAssessment/details'
import type { AssessmentArtifactType } from '@prisma/client'

export {
  assertClinicalAssessmentStoragePath,
  artifactDownloadLabel,
  ASSESSMENT_ARTIFACT_LABELS,
  isStoredClinicalAssessmentPath,
  MAX_CLINICAL_ASSESSMENT_BYTES,
  missingAssessmentArtifactTypes,
  ALL_ASSESSMENT_ARTIFACT_TYPES,
  OPTIONAL_ASSESSMENT_ARTIFACT_TYPES,
  parseAssessmentArtifactType,
  REQUIRED_ASSESSMENT_ARTIFACT_TYPES,
  validateClinicalAssessmentFile,
  VERCEL_CLINICAL_ASSESSMENT_UPLOAD_BODY_LIMIT_BYTES,
} from '@/lib/crm/clinicalAssessment/artifacts.shared'

export function buildClinicalAssessmentStoragePath(input: {
  clientId: string
  assessmentId: string
  artifactType: AssessmentArtifactType
  fileName: string
}): string {
  const ext = input.fileName.split('.').pop()?.toLowerCase() || 'bin'
  const id = randomUUID()
  return `${CRM_CLINICAL_ASSESSMENTS_PREFIX}/${input.clientId}/${input.assessmentId}/${input.artifactType.toLowerCase()}-${id}.${ext}`
}

export type ClinicalAssessmentSignedUpload = {
  signedUrl: string
  token: string
  storagePath: string
  contentType: string
}

export async function createClinicalAssessmentSignedUpload(input: {
  clientId: string
  assessmentId: string
  artifactType: AssessmentArtifactType
  fileName: string
  contentType: string
}): Promise<ClinicalAssessmentSignedUpload> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  const storagePath = buildClinicalAssessmentStoragePath(input)
  const contentType = input.contentType || 'application/octet-stream'
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false })
  if (error || !data?.signedUrl) {
    console.error('[crm-clinical-assessment] signed upload url failed', error)
    throw new Error('Could not prepare upload')
  }
  return {
    signedUrl: data.signedUrl,
    token: data.token,
    storagePath: data.path ?? storagePath,
    contentType,
  }
}

export async function clinicalAssessmentObjectExists(
  storagePath: string
): Promise<boolean> {
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

export async function downloadClinicalAssessmentArtifact(
  storagePath: string
): Promise<{ bytes: Buffer; contentType: string }> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  if (!isStoredClinicalAssessmentPath(storagePath)) {
    throw new Error('Invalid storage path')
  }
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(storagePath)
  if (error || !data) {
    console.error('[crm-clinical-assessment] download failed', error)
    throw new Error('Download failed')
  }
  const arrayBuffer = await data.arrayBuffer()
  return {
    bytes: Buffer.from(arrayBuffer),
    contentType: data.type || 'application/octet-stream',
  }
}

export async function attachClinicalAssessmentArtifactRecord(input: {
  assessmentId: string
  clientId: string
  userId: string
  artifactType: AssessmentArtifactType
  storagePath: string
  fileName: string
  contentType: string
  sizeBytes: number
}) {
  assertClinicalAssessmentStoragePath({
    clientId: input.clientId,
    assessmentId: input.assessmentId,
    storagePath: input.storagePath,
  })
  if (!(await clinicalAssessmentObjectExists(input.storagePath))) {
    throw new Error('Uploaded file not found in storage')
  }

  const assessment = await prisma.clientClinicalAssessment.findFirst({
    where: {
      id: input.assessmentId,
      serviceClientId: input.clientId,
      lockState: 'DRAFT',
    },
    select: { id: true },
  })
  if (!assessment) {
    throw new Error('Assessment is locked or not found')
  }

  const existing = await prisma.clientClinicalAssessmentArtifact.findFirst({
    where: {
      assessmentId: input.assessmentId,
      artifactType: input.artifactType,
      deletedAt: null,
    },
    select: { id: true },
  })
  if (existing) {
    await prisma.clientClinicalAssessmentArtifact.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        deletedByUserId: input.userId,
      },
    })
  }

  return prisma.clientClinicalAssessmentArtifact.create({
    data: {
      assessmentId: input.assessmentId,
      artifactType: input.artifactType,
      storagePath: input.storagePath,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      uploadedByUserId: input.userId,
    },
  })
}

export async function createClinicalAssessmentGraphSignedUrl(
  storagePath: string,
  ttlSeconds = 60
): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('Storage not configured')
  }
  if (!isStoredClinicalAssessmentPath(storagePath)) {
    throw new Error('Invalid storage path')
  }
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds)
  if (error || !data?.signedUrl) {
    throw new Error('Could not sign graph URL')
  }
  return data.signedUrl
}

export async function getOrCreateCurrentClinicalAssessment(input: {
  clientId: string
  userId: string
}) {
  const current = await prisma.clientClinicalAssessment.findFirst({
    where: {
      serviceClientId: input.clientId,
      isCurrentVersion: true,
    },
    include: {
      artifacts: {
        where: { deletedAt: null },
        orderBy: { artifactType: 'asc' },
      },
      details: true,
    },
  })
  if (current) {
    if (!current.details) {
      await ensureAssessmentDetailsForAssessment(current.id)
      return prisma.clientClinicalAssessment.findFirstOrThrow({
        where: { id: current.id },
        include: {
          artifacts: {
            where: { deletedAt: null },
            orderBy: { artifactType: 'asc' },
          },
          details: true,
        },
      })
    }
    return current
  }

  return prisma.clientClinicalAssessment.create({
    data: {
      serviceClientId: input.clientId,
      versionNumber: 1,
      isCurrentVersion: true,
      createdByUserId: input.userId,
      details: { create: {} },
    },
    include: {
      artifacts: {
        where: { deletedAt: null },
        orderBy: { artifactType: 'asc' },
      },
      details: true,
    },
  })
}

export async function listClinicalAssessmentVersions(clientId: string) {
  return prisma.clientClinicalAssessment.findMany({
    where: { serviceClientId: clientId },
    orderBy: { versionNumber: 'desc' },
    include: {
      artifacts: { where: { deletedAt: null }, orderBy: { artifactType: 'asc' } },
      details: true,
      lockedByUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
    },
  })
}

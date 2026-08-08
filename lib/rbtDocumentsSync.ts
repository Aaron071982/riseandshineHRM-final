import type { PrismaClient } from '@prisma/client'

/**
 * Catalog onboarding UPLOAD step slugs → `RBTDocument.documentType`.
 * Keeps Document Center / admin Documents tab in sync with wizard uploads.
 */
export const ONBOARDING_UPLOAD_SLUG_TO_DOC_TYPE: Record<string, string> = {
  'upload-social-security-card': 'SOCIAL_SECURITY_CARD',
  'cpr-first-aid-certificate': 'CPR_CARD',
  'forty-hour-rbt-certificate': 'FORTY_HOUR_CERTIFICATE',
  'mandated-reporter-certificate': 'MANDATED_REPORTER_CERTIFICATE',
}

export function isOnboardingUploadSlug(slug: string | null | undefined): boolean {
  return Boolean(slug && slug in ONBOARDING_UPLOAD_SLUG_TO_DOC_TYPE)
}

export function mimeTypeFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return 'application/pdf'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'doc':
      return 'application/msword'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default:
      return 'application/octet-stream'
  }
}

/**
 * Replace any existing RBT document of this type (one canonical file per type).
 * `fileBase64` is raw base64 (not a data URL).
 */
export async function replaceRbtDocumentOfType(
  prisma: PrismaClient,
  input: {
    rbtProfileId: string
    documentType: string
    fileName: string
    fileType: string
    fileBase64: string
  }
) {
  await prisma.rBTDocument.deleteMany({
    where: { rbtProfileId: input.rbtProfileId, documentType: input.documentType },
  })
  return prisma.rBTDocument.create({
    data: {
      rbtProfileId: input.rbtProfileId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileData: input.fileBase64,
      documentType: input.documentType,
    },
  })
}

export const COMPANY_DOC_SUBMISSION_TYPE = 'COMPANY_DOCUMENT_SUBMISSION'

/**
 * Mirror a company-document DOWNLOAD_UPLOAD submission onto the RBT Documents tab.
 * One row per company document title (re-submit replaces the prior file for that title).
 */
export async function upsertCompanyDocSubmissionOnProfile(
  prisma: PrismaClient,
  input: {
    rbtProfileId: string
    companyDocumentTitle: string
    storagePath: string
    fileName?: string
    fileType?: string
  }
) {
  const pathBase = input.storagePath.split('/').pop() || 'submission.bin'
  const ext = pathBase.includes('.') ? pathBase.slice(pathBase.lastIndexOf('.')) : ''
  const safeTitle =
    input.companyDocumentTitle.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_|_$/g, '') ||
    'company_document'
  // Stable name so re-submits replace the prior profile copy for this company doc title
  const fileName = `${safeTitle}_submitted${ext || ''}`
  const fileType = input.fileType || mimeTypeFromFileName(input.fileName || fileName)

  await prisma.rBTDocument.deleteMany({
    where: {
      rbtProfileId: input.rbtProfileId,
      documentType: COMPANY_DOC_SUBMISSION_TYPE,
      fileName,
    },
  })

  return prisma.rBTDocument.create({
    data: {
      rbtProfileId: input.rbtProfileId,
      fileName,
      fileType,
      fileData: '',
      filePath: input.storagePath,
      documentType: COMPANY_DOC_SUBMISSION_TYPE,
    },
  })
}

import type { PrismaClient } from '@prisma/client'

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

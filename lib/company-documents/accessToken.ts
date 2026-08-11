import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import type { CompanyDocument, CompanyDocumentRecipient, CompanyDocumentType } from '@prisma/client'

/** Direct email access is only for view / typed e-sign — not download-upload. */
export function supportsDirectEmailAccess(documentType: CompanyDocumentType): boolean {
  return documentType === 'ACKNOWLEDGMENT' || documentType === 'VIEW_ONLY'
}

export const COMPANY_DOC_TOKEN_TTL_DAYS = 90

export function hashCompanyDocAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function mintCompanyDocAccessToken(): {
  token: string
  hash: string
  expiresAt: Date
} {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + COMPANY_DOC_TOKEN_TTL_DAYS)
  return { token, hash: hashCompanyDocAccessToken(token), expiresAt }
}

export type CompanyDocAccessRow = CompanyDocumentRecipient & {
  companyDocument: CompanyDocument
  rbtProfile: { id: string; firstName: string; lastName: string; email: string | null }
}

/** Resolve a valid magic-link token to recipient + document. */
export async function resolveCompanyDocAccessToken(
  rawToken: string
): Promise<CompanyDocAccessRow | null> {
  const token = (rawToken ?? '').trim()
  if (!token || token.length < 32) return null

  const hash = hashCompanyDocAccessToken(token)
  const row = await prisma.companyDocumentRecipient.findUnique({
    where: { accessTokenHash: hash },
    include: {
      companyDocument: true,
      rbtProfile: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  })
  if (!row) return null
  if (!row.companyDocument.isActive) return null
  if (!supportsDirectEmailAccess(row.companyDocument.documentType)) return null
  if (!row.accessTokenExpiresAt || row.accessTokenExpiresAt.getTime() < Date.now()) {
    return null
  }
  return row
}

/** Issue (or rotate) a magic-link token for one recipient and persist the hash. */
export async function issueCompanyDocAccessToken(opts: {
  companyDocumentId: string
  rbtProfileId: string
}): Promise<{ token: string; expiresAt: Date } | null> {
  const { token, hash, expiresAt } = mintCompanyDocAccessToken()
  try {
    await prisma.companyDocumentRecipient.update({
      where: {
        companyDocumentId_rbtProfileId: {
          companyDocumentId: opts.companyDocumentId,
          rbtProfileId: opts.rbtProfileId,
        },
      },
      data: {
        accessTokenHash: hash,
        accessTokenExpiresAt: expiresAt,
      },
    })
    return { token, expiresAt }
  } catch {
    return null
  }
}

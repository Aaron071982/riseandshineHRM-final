import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  downloadRequirementDocument,
  isStoredRequirementPath,
  requirementDownloadFileName,
} from '@/lib/crm/requirementDocuments'
import { verifyDocumentViewToken } from '@/lib/mcp/documentAccess'
import { buildContentDisposition } from '@/lib/http/contentDisposition'
import { getClientIpFromRequest } from '@/lib/client-ip'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t') ?? ''
  const payload = verifyDocumentViewToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired viewing link' }, { status: 401 })
  }

  const requirement = await prisma.clientRequirement.findFirst({
    where: { id: payload.requirementId, deletedAt: null },
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
  if (!requirement || !isStoredRequirementPath(requirement.fileUrl) || !requirement.fileUrl) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const { bytes, contentType } = await downloadRequirementDocument(requirement.fileUrl)
  const downloadName = requirementDownloadFileName({
    fileName: requirement.fileName,
    fileUrl: requirement.fileUrl,
    label: requirement.label,
  })

  console.info(
    '[mcp-document-view]',
    JSON.stringify({
      requirementId: requirement.id,
      userId: payload.userId,
      ip: getClientIpFromRequest(request),
    })
  )

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': requirement.fileContentType || contentType,
      'Content-Disposition': buildContentDisposition('inline', downloadName),
      'Content-Length': bytes.length.toString(),
      'Cache-Control': 'private, no-store',
    },
  })
}

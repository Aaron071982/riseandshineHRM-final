import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { statusCounts } from '@/lib/company-documents/distribute'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  const doc = await prisma.companyDocument.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { name: true, email: true } },
      recipients: {
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        include: {
          rbtProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      fileUrl: doc.fileUrl,
      fileType: doc.fileType,
      documentType: doc.documentType,
      isActive: doc.isActive,
      isTest: doc.isTest,
      createdAt: doc.createdAt.toISOString(),
      uploadedBy: doc.uploadedBy,
      counts: statusCounts(doc.recipients),
      recipients: doc.recipients.map((r) => ({
        id: r.id,
        status: r.status,
        signedName: r.signedName,
        signedAt: r.signedAt?.toISOString() ?? null,
        viewedAt: r.viewedAt?.toISOString() ?? null,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        emailSentAt: r.emailSentAt?.toISOString() ?? null,
        uploadedFileUrl: r.uploadedFileUrl,
        rbt: {
          id: r.rbtProfile.id,
          name: `${r.rbtProfile.firstName} ${r.rbtProfile.lastName}`.trim(),
          email: r.rbtProfile.email || r.rbtProfile.user?.email || null,
        },
      })),
    },
  })
}

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { I9_SLUG } from '@/lib/onboarding/catalog'
import { seedOnboardingCatalog } from '@/lib/onboarding/provision'
import { I9_DOCUMENT_TYPE } from '@/lib/rbtDocumentsSync'
import { I9_DOCUMENT_TYPES } from '@/lib/compliance/i9Status'
import RbtI9Portal from '@/components/rbt/RbtI9Portal'

export const dynamic = 'force-dynamic'

export default async function RbtI9Page() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  if (!sessionToken) redirect('/')

  const user = await validateSession(sessionToken)
  if (!user || (user.role !== 'RBT' && user.role !== 'CANDIDATE') || !user.rbtProfileId) {
    redirect('/')
  }

  let i9Doc = await prisma.onboardingDocument.findFirst({
    where: { slug: I9_SLUG, isActive: true },
    select: { id: true, title: true },
  })
  if (!i9Doc) {
    await seedOnboardingCatalog()
    i9Doc = await prisma.onboardingDocument.findFirst({
      where: { slug: I9_SLUG, isActive: true },
      select: { id: true, title: true },
    })
  }

  const [profile, documents] = await Promise.all([
    prisma.rBTProfile.findUniqueOrThrow({
      where: { id: user.rbtProfileId },
      select: { i9Section1CompletedAt: true, i9Section2CompletedAt: true },
    }),
    prisma.rBTDocument.findMany({
      where: { rbtProfileId: user.rbtProfileId, documentType: { in: [...I9_DOCUMENT_TYPES] } },
      select: { id: true, fileName: true, documentType: true, uploadedAt: true },
      orderBy: { uploadedAt: 'desc' },
    }),
  ])

  const hasForm =
    profile.i9Section1CompletedAt != null || documents.some((d) => d.documentType === I9_DOCUMENT_TYPE)
  const status = profile.i9Section2CompletedAt ? 'complete' : hasForm ? 'submitted' : 'needed'

  return (
    <RbtI9Portal
      i9DocumentId={i9Doc?.id ?? null}
      status={status}
      documents={documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        isForm: d.documentType === I9_DOCUMENT_TYPE,
        uploadedAt: d.uploadedAt.toISOString(),
      }))}
    />
  )
}

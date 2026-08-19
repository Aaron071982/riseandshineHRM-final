import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { syncTierMilestones, canUnlockStep, completedStepNumbers } from '@/lib/onboarding/progress'
import { FORTY_HOUR_RBT_CERTIFICATE_SLUG } from '@/lib/onboarding/catalog'
import {
  ONBOARDING_UPLOAD_SLUG_TO_DOC_TYPE,
  mimeTypeFromFileName,
  replaceRbtDocumentOfType,
} from '@/lib/rbtDocumentsSync'
import type { FolderType } from '@prisma/client'

const SLUG_FOLDER: Record<string, FolderType> = {
  'upload-social-security-card': 'PERSONAL_DOCUMENTS',
  'mandated-reporter-certificate': 'RBT_CERTIFICATE',
  'cpr-first-aid-certificate': 'RBT_CERTIFICATE',
  'forty-hour-rbt-certificate': 'RBT_CERTIFICATE',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(token)
    if (!user?.rbtProfileId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const document = await prisma.onboardingDocument.findUnique({ where: { id: documentId } })
    if (!document || document.flowType !== 'UPLOAD') {
      return NextResponse.json({ error: 'Invalid upload step' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File must be under 10MB' }, { status: 400 })
    }

    const docs = await prisma.onboardingDocument.findMany({
      where: { isActive: true, stepNumber: { not: null } },
    })
    const completions = await prisma.onboardingCompletion.findMany({
      where: { rbtProfileId: user.rbtProfileId },
    })
    const profile = await prisma.rBTProfile.findUniqueOrThrow({
      where: { id: user.rbtProfileId },
      select: {
        artemisTrainingCompleted: true,
        backgroundCheckClearedAt: true,
        supervisionCountersignedAt: true,
        fortyHourCourseCompleted: true,
      },
    })
    const done = completedStepNumbers(docs, completions, profile)
    if (document.stepNumber && !canUnlockStep(document.stepNumber, done)) {
      return NextResponse.json({ error: 'This step is locked' }, { status: 403 })
    }

    const ext = file.name.split('.').pop() || 'bin'
    const path = `${user.rbtProfileId}/${document.slug}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
    }
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('[onboarding upload]', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const now = new Date()
    const folderType = SLUG_FOLDER[document.slug] ?? 'PERSONAL_DOCUMENTS'

    const tx = [
      prisma.onboardingCompletion.upsert({
        where: {
          rbtProfileId_documentId: { rbtProfileId: user.rbtProfileId, documentId },
        },
        create: {
          rbtProfileId: user.rbtProfileId,
          documentId,
          status: 'COMPLETED',
          completedAt: now,
          signedPdfUrl: path,
          storageBucket: STORAGE_BUCKET,
        },
        update: {
          status: 'COMPLETED',
          completedAt: now,
          signedPdfUrl: path,
          storageBucket: STORAGE_BUCKET,
        },
      }),
      prisma.employeeDocumentFolder.create({
        data: {
          rbtProfileId: user.rbtProfileId,
          folderType,
          fileUrl: path,
          fileName: file.name,
          uploadedBy: user.id,
        },
      }),
      ...(document.slug === FORTY_HOUR_RBT_CERTIFICATE_SLUG
        ? [
            prisma.rBTProfile.update({
              where: { id: user.rbtProfileId },
              data: { fortyHourCourseCompleted: true },
            }),
          ]
        : []),
    ]

    await prisma.$transaction(tx)

    // Mirror into rbt_documents so admin Documents + RBT Document Center show the file
    const docType = ONBOARDING_UPLOAD_SLUG_TO_DOC_TYPE[document.slug]
    if (docType) {
      try {
        await replaceRbtDocumentOfType(prisma, {
          rbtProfileId: user.rbtProfileId,
          documentType: docType,
          fileName: file.name || document.slug,
          fileType: file.type || mimeTypeFromFileName(file.name || path),
          fileBase64: buffer.toString('base64'),
        })
      } catch (e) {
        console.error('[onboarding document upload] Failed to sync to rbt_documents:', e)
      }
    }

    await syncTierMilestones(user.rbtProfileId)
    return NextResponse.json({ success: true, path })
  } catch (e) {
    console.error('[onboarding document upload]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  QUIZ_PASS_SCORE,
  QUIZ_TOTAL_QUESTIONS,
  SEXUAL_HARASSMENT_QUIZ_QUESTIONS,
} from '@/lib/onboarding/quiz-questions'
import { syncTierMilestones } from '@/lib/onboarding/progress'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(token)
    if (!user?.rbtProfileId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { answers } = (await request.json()) as { answers?: Record<string, string> }
    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'answers required' }, { status: 400 })
    }

    const doc = await prisma.onboardingDocument.findFirst({
      where: { slug: 'sexual-harassment-training', isActive: true },
    })
    if (!doc) return NextResponse.json({ error: 'Training not configured' }, { status: 404 })

    const existingCompletion = await prisma.onboardingCompletion.findUnique({
      where: {
        rbtProfileId_documentId: { rbtProfileId: user.rbtProfileId, documentId: doc.id },
      },
    })
    if (existingCompletion?.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Quiz already passed' }, { status: 400 })
    }

    let score = 0
    const wrong: Array<{ questionId: number; correctOptionId: string; explanation: string }> = []
    for (const q of SEXUAL_HARASSMENT_QUIZ_QUESTIONS) {
      if (answers[String(q.id)] === q.correctOptionId) score++
      else {
        wrong.push({
          questionId: q.id,
          correctOptionId: q.correctOptionId,
          explanation: q.explanation,
        })
      }
    }

    const passed = score >= QUIZ_PASS_SCORE
    const now = new Date()
    const priorAttempts = await prisma.onboardingQuizAttempt.count({
      where: { rbtProfileId: user.rbtProfileId, documentId: doc.id },
    })
    const attemptNumber = priorAttempts + 1
    const percentScore = Math.round((score / QUIZ_TOTAL_QUESTIONS) * 100)

    await prisma.onboardingQuizAttempt.create({
      data: {
        rbtProfileId: user.rbtProfileId,
        documentId: doc.id,
        score,
        totalQuestions: QUIZ_TOTAL_QUESTIONS,
        passed,
        answersJson: { answers, attemptNumber, percentScore },
        nextAttemptAt: null,
      },
    })

    if (!passed) {
      await prisma.onboardingCompletion.upsert({
        where: {
          rbtProfileId_documentId: { rbtProfileId: user.rbtProfileId, documentId: doc.id },
        },
        create: {
          rbtProfileId: user.rbtProfileId,
          documentId: doc.id,
          status: 'IN_PROGRESS',
          acknowledgmentJson: {
            lastAttempt: {
              attemptNumber,
              score,
              percentScore,
              passed: false,
              attemptedAt: now.toISOString(),
            },
          },
        },
        update: {
          status: 'IN_PROGRESS',
          completedAt: null,
          acknowledgmentJson: {
            lastAttempt: {
              attemptNumber,
              score,
              percentScore,
              passed: false,
              attemptedAt: now.toISOString(),
            },
          },
        },
      })

      return NextResponse.json({
        success: false,
        passed: false,
        score,
        percentScore,
        total: QUIZ_TOTAL_QUESTIONS,
        attemptNumber,
        attemptedAt: now.toISOString(),
        wrong,
      })
    }

    const rbt = await prisma.rBTProfile.findUniqueOrThrow({
      where: { id: user.rbtProfileId },
      select: { firstName: true, lastName: true },
    })
    const employeeName = `${rbt.firstName} ${rbt.lastName}`.trim()
    const nextRequiredAt = new Date(now)
    nextRequiredAt.setFullYear(nextRequiredAt.getFullYear() + 1)
    const trainingSource = 'NY State DOL Model Training, April 2023'

    const certificateJson = {
      employeeName,
      rbtProfileId: user.rbtProfileId,
      score,
      percentScore,
      attemptNumber,
      totalQuestions: QUIZ_TOTAL_QUESTIONS,
      completedAt: now.toISOString(),
      trainingSource,
      nextRequiredAt: nextRequiredAt.toISOString(),
    }

    await prisma.onboardingQuizCertificate.create({
      data: {
        rbtProfileId: user.rbtProfileId,
        documentId: doc.id,
        employeeName,
        score,
        totalQuestions: QUIZ_TOTAL_QUESTIONS,
        completedAt: now,
        trainingSource,
        nextRequiredAt,
        certificateJson,
      },
    })

    await prisma.onboardingCompletion.upsert({
      where: {
        rbtProfileId_documentId: { rbtProfileId: user.rbtProfileId, documentId: doc.id },
      },
      create: {
        rbtProfileId: user.rbtProfileId,
        documentId: doc.id,
        status: 'COMPLETED',
        completedAt: now,
        acknowledgmentJson: certificateJson,
      },
      update: { status: 'COMPLETED', completedAt: now, acknowledgmentJson: certificateJson },
    })

    await prisma.employeeDocumentFolder.create({
      data: {
        rbtProfileId: user.rbtProfileId,
        folderType: 'RBT_CERTIFICATE',
        fileUrl: `quiz-cert:${doc.id}`,
        fileName: `Sexual_Harassment_Training_${now.toISOString().slice(0, 10)}.json`,
        uploadedBy: user.id,
        notes: `Score ${score}/${QUIZ_TOTAL_QUESTIONS} (${percentScore}%) — attempt ${attemptNumber}`,
      },
    })

    await syncTierMilestones(user.rbtProfileId)

    return NextResponse.json({
      success: true,
      passed: true,
      score,
      percentScore,
      attemptNumber,
      attemptedAt: now.toISOString(),
      total: QUIZ_TOTAL_QUESTIONS,
      nextRequiredAt,
    })
  } catch (e) {
    console.error('[quiz/submit]', e)
    return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 })
  }
}

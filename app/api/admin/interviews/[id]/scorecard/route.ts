import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import {
  SCORECARD_CATEGORIES,
  isScorecardCategory,
  isValidScore,
  computeOverallScore,
} from '@/lib/scorecard'

type ScoresRecord = Record<string, number>
type CommentsRecord = Record<string, string>

function formatScorecardResponse(scorecard: {
  id: string
  interviewId: string
  createdByUserId: string
  scores: unknown
  comments: unknown
  createdAt: Date
  updatedAt: Date
}) {
  const scores = (scorecard.scores as ScoresRecord) || {}
  const { overallScore, ratedCount } = computeOverallScore(scores)
  return {
    id: scorecard.id,
    interviewId: scorecard.interviewId,
    createdByUserId: scorecard.createdByUserId,
    scores,
    comments: (scorecard.comments as CommentsRecord) || {},
    createdAt: scorecard.createdAt,
    updatedAt: scorecard.updatedAt,
    overallScore,
    ratedCount,
  }
}

// GET: Return current user's scorecard for this interview or null
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: interviewId } = await params

    const scorecard = await prisma.interviewScorecard.findUnique({
      where: {
        interviewId_createdByUserId: { interviewId, createdByUserId: user.id },
      },
    })

    if (!scorecard) {
      return NextResponse.json({ scorecard: null })
    }

    return NextResponse.json({
      scorecard: formatScorecardResponse(scorecard),
    })
  } catch (error: unknown) {
    console.error('Error fetching interview scorecard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch interview scorecard' },
      { status: 500 }
    )
  }
}

// PUT: Upsert scorecard for current user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: interviewId } = await params

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
    })
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    const body = await request.json()
    const rawScores = body.scores ?? {}
    const rawComments = body.comments ?? {}

    // Validate scores: keys must be valid categories, values 1-5
    const scores: ScoresRecord = {}
    for (const [key, value] of Object.entries(rawScores)) {
      if (!isScorecardCategory(key)) continue
      if (!isValidScore(value)) continue
      scores[key] = value as number
    }

    // Validate comments: keys must be valid categories, values string
    const comments: CommentsRecord = {}
    for (const [key, value] of Object.entries(rawComments)) {
      if (!isScorecardCategory(key)) continue
      if (typeof value !== 'string') continue
      comments[key] = value
    }

    const existing = await prisma.interviewScorecard.findUnique({
      where: {
        interviewId_createdByUserId: { interviewId, createdByUserId: user.id },
      },
    })

    const changedCategories = existing
      ? [
          ...new Set([
            ...Object.keys(scores),
            ...Object.keys((existing.scores as ScoresRecord) || {}),
          ]),
        ]
      : Object.keys(scores)

    const scorecard = await prisma.interviewScorecard.upsert({
      where: {
        interviewId_createdByUserId: { interviewId, createdByUserId: user.id },
      },
      update: { scores, comments, updatedAt: new Date() },
      create: {
        interviewId,
        createdByUserId: user.id,
        scores,
        comments,
      },
    })

    // Audit log
    try {
      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        null
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: 'FORM_SUBMISSION',
          action: 'scorecard_updated',
          resourceType: 'interview',
          resourceId: interviewId,
          ipAddress,
          userAgent: request.headers.get('user-agent') || null,
          metadata: { changedCategories },
        },
      })
    } catch (auditError) {
      console.error('Error creating scorecard audit log:', auditError)
    }

    return NextResponse.json({
      scorecard: formatScorecardResponse(scorecard),
    })
  } catch (error: unknown) {
    console.error('Error saving interview scorecard:', error)
    return NextResponse.json(
      { error: 'Failed to save interview scorecard' },
      { status: 500 }
    )
  }
}

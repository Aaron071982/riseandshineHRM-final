import { NextRequest, NextResponse } from 'next/server'
import { requireDocumentsAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { I9_SLUG } from '@/lib/onboarding/catalog'
import { syncTierMilestones } from '@/lib/onboarding/progress'

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Record Form I-9 sections.
 * - section 1: employee portion received outside the app (e.g. paper form).
 * - section 2: employer examined identity / work-authorization documents.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDocumentsAdminSession()
  if (auth.response) return auth.response
  const actor = auth.user

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as {
    section?: number
    completedAt?: string
    notes?: string
  }
  const section = body.section
  if (section !== 1 && section !== 2) {
    return NextResponse.json({ error: 'section must be 1 or 2' }, { status: 400 })
  }

  const completedAt = parseDate(body.completedAt) ?? new Date()
  if (completedAt.getTime() > Date.now() + 60_000) {
    return NextResponse.json({ error: 'Completion date cannot be in the future' }, { status: 400 })
  }
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

  const profile = await prisma.rBTProfile.findUnique({
    where: { id },
    select: { id: true, i9Section1CompletedAt: true, i9Section2CompletedAt: true },
  })
  if (!profile) return NextResponse.json({ error: 'RBT not found' }, { status: 404 })

  if (section === 1 && profile.i9Section1CompletedAt) {
    return NextResponse.json({ error: 'Section 1 is already recorded' }, { status: 409 })
  }
  if (section === 2) {
    if (profile.i9Section2CompletedAt) {
      return NextResponse.json({ error: 'Section 2 is already recorded' }, { status: 409 })
    }
    if (!profile.i9Section1CompletedAt) {
      return NextResponse.json(
        { error: 'Record Section 1 (employee portion) before Section 2' },
        { status: 400 }
      )
    }
    if (!notes) {
      return NextResponse.json(
        { error: 'List the documents examined (List A, or List B + List C)' },
        { status: 400 }
      )
    }
  }

  const doc = await prisma.onboardingDocument.findFirst({
    where: { slug: I9_SLUG, isActive: true },
    select: { id: true },
  })
  const bothDone = section === 2 || !!profile.i9Section2CompletedAt
  const actorLabel = actor.email || actor.name || 'Admin'

  await prisma.$transaction([
    prisma.rBTProfile.update({
      where: { id },
      data:
        section === 1
          ? { i9Section1CompletedAt: completedAt }
          : {
              i9Section2CompletedAt: completedAt,
              i9Section2CompletedBy: actor.id,
              i9Section2Notes: notes,
            },
    }),
    ...(doc
      ? [
          prisma.onboardingCompletion.upsert({
            where: { rbtProfileId_documentId: { rbtProfileId: id, documentId: doc.id } },
            create: {
              rbtProfileId: id,
              documentId: doc.id,
              status: bothDone ? 'COMPLETED' : 'IN_PROGRESS',
              completedAt: bothDone ? completedAt : null,
            },
            update: {
              status: bothDone ? 'COMPLETED' : 'IN_PROGRESS',
              completedAt: bothDone ? completedAt : null,
            },
          }),
        ]
      : []),
    prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: id,
        auditType: 'COMPLIANCE',
        dateTime: new Date(),
        notes:
          section === 1
            ? `Form I-9 Section 1 recorded by admin (completed ${completedAt.toISOString().slice(0, 10)})${notes ? ` — ${notes}` : ''}`
            : `Form I-9 Section 2 completed (documents examined ${completedAt.toISOString().slice(0, 10)}): ${notes}`,
        createdBy: actorLabel,
      },
    }),
  ])

  await syncTierMilestones(id)
  return NextResponse.json({ success: true })
}

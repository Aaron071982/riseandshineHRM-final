import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

// GET: Retrieve interview notes
export async function GET(
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

    const { id } = await params

    const notes = await prisma.interviewNotes.findUnique({
      where: { interviewId: id },
    })

    return NextResponse.json(notes || null)
  } catch (error: unknown) {
    const err = error as Error & { code?: string; meta?: unknown }
    console.error('Error fetching interview notes:', err?.message, err?.stack, err?.code, err?.meta)
    return NextResponse.json(
      { error: 'Failed to fetch interview notes' },
      { status: 500 }
    )
  }
}

// Coerce to string or null for Prisma String? fields (avoids type errors from client)
function strOrNull(v: unknown): string | null {
  if (v == null || v === '') return null
  return String(v)
}

// POST: Create or update interview notes
export async function POST(
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

    const { id } = await params

    let data: Record<string, unknown>
    try {
      data = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    if (data == null || typeof data !== 'object') {
      data = {}
    }

    // Get interview to get rbtProfileId
    const interview = await prisma.interview.findUnique({
      where: { id },
    })

    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }

    // Build payload with coerced string | null (Prisma String? compatible)
    const updateData = {
      greetingAnswer: strOrNull(data.greetingAnswer),
      basicInfoAnswer: strOrNull(data.basicInfoAnswer),
      experienceAnswer: strOrNull(data.experienceAnswer),
      heardAboutAnswer: strOrNull(data.heardAboutAnswer),
      abaPlatformsAnswer: strOrNull(data.abaPlatformsAnswer),
      communicationAnswer: strOrNull(data.communicationAnswer),
      availabilityAnswer: strOrNull(data.availabilityAnswer),
      payExpectationsAnswer: strOrNull(data.payExpectationsAnswer),
      previousCompanyAnswer: strOrNull(data.previousCompanyAnswer),
      expectationsAnswer: strOrNull(data.expectationsAnswer),
      closingNotes: strOrNull(data.closingNotes),
      fullName: strOrNull(data.fullName),
      email: strOrNull(data.email),
      birthdate: strOrNull(data.birthdate),
      currentAddress: strOrNull(data.currentAddress),
      phoneNumber: strOrNull(data.phoneNumber),
    }

    const notes = await prisma.interviewNotes.upsert({
      where: { interviewId: id },
      update: updateData,
      create: {
        interviewId: id,
        rbtProfileId: interview.rbtProfileId,
        ...updateData,
      },
    })

    return NextResponse.json({ success: true, notes })
  } catch (error: unknown) {
    const err = error as Error & { code?: string; meta?: unknown }
    console.error('Error saving interview notes:', err?.message, err?.stack, err?.code, err?.meta)
    // If error mentions permission/RLS, run prisma/supabase-rls-policies-app.sql in Supabase SQL Editor.
    const message =
      process.env.NODE_ENV === 'development' && err?.message
        ? err.message
        : 'Failed to save interview notes'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


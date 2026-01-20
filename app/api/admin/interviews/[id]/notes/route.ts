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
  } catch (error: any) {
    console.error('Error fetching interview notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch interview notes' },
      { status: 500 }
    )
  }
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
    const data = await request.json()

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

    // Upsert interview notes
    const updateData: any = {
      greetingAnswer: data.greetingAnswer || null,
      basicInfoAnswer: data.basicInfoAnswer || null,
      experienceAnswer: data.experienceAnswer || null,
      heardAboutAnswer: data.heardAboutAnswer || null,
      abaPlatformsAnswer: data.abaPlatformsAnswer || null,
      communicationAnswer: data.communicationAnswer || null,
      availabilityAnswer: data.availabilityAnswer || null,
      payExpectationsAnswer: data.payExpectationsAnswer || null,
      previousCompanyAnswer: data.previousCompanyAnswer || null,
      expectationsAnswer: data.expectationsAnswer || null,
      closingNotes: data.closingNotes || null,
      fullName: data.fullName || null,
      birthdate: data.birthdate || null,
      currentAddress: data.currentAddress || null,
      phoneNumber: data.phoneNumber || null,
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
  } catch (error: any) {
    console.error('Error saving interview notes:', error)
    return NextResponse.json(
      { error: 'Failed to save interview notes' },
      { status: 500 }
    )
  }
}


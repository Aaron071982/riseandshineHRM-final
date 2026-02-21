import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { sendGenericEmail, generateTeamWelcomeEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { teamId } = await params
    const body = await request.json()
    const { fullName, email, phone, role, notes } = body as {
      fullName?: string
      email?: string
      phone?: string
      role?: string
      notes?: string
    }

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    const member = await prisma.devTeamMember.create({
      data: {
        devTeamId: teamId,
        fullName: fullName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        role: role?.trim() || null,
        notes: notes?.trim() || null,
      },
    })

    if (member.email) {
      const { subject, html } = generateTeamWelcomeEmail(member.fullName, 'Dev')
      await sendGenericEmail(member.email, subject, html)
    }

    return NextResponse.json({ id: member.id, success: true })
  } catch (error) {
    console.error('Error creating Dev team member:', error)
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 })
  }
}

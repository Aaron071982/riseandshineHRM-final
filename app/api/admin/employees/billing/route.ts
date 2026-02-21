import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { sendGenericEmail, generateTeamWelcomeEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { fullName, email, phone, title, department, startDate, notes, status } = body as {
      fullName?: string
      email?: string
      phone?: string
      title?: string
      department?: string
      startDate?: string
      notes?: string
      status?: string
    }

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    const profile = await prisma.billingProfile.create({
      data: {
        fullName: fullName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        title: title?.trim() || null,
        department: department?.trim() || null,
        startDate: startDate ? new Date(startDate) : null,
        notes: notes?.trim() || null,
        status: status?.trim() || null,
      },
    })

    if (profile.email) {
      const { subject, html } = generateTeamWelcomeEmail(profile.fullName, 'Billing')
      await sendGenericEmail(profile.email, subject, html)
    }

    return NextResponse.json({ id: profile.id, success: true })
  } catch (error) {
    console.error('Error creating Billing profile:', error)
    return NextResponse.json({ error: 'Failed to create billing profile' }, { status: 500 })
  }
}

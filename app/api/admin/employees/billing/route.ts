import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { sendGenericEmail, generateTeamWelcomeEmail } from '@/lib/email'
import { ensureEmployeeForBillingProfile } from '@/lib/employees'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
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

    // Create Employee wrapper row for this billing profile
    await ensureEmployeeForBillingProfile(profile.id)

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

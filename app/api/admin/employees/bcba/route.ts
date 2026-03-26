import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { sendGenericEmail, generateTeamWelcomeEmail } from '@/lib/email'
import { ensureEmployeeForBcbaProfile } from '@/lib/employees'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const body = await request.json()
    const {
      fullName,
      email,
      phone,
      certificationNumber,
      certificationExpiresAt,
      isSupervisor,
      preferredRegions,
      notes,
      status,
    } = body as {
      fullName?: string
      email?: string
      phone?: string
      certificationNumber?: string
      certificationExpiresAt?: string
      isSupervisor?: boolean
      preferredRegions?: string
      notes?: string
      status?: string
    }

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    const profile = await prisma.bCBAProfile.create({
      data: {
        fullName: fullName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        certificationNumber: certificationNumber?.trim() || null,
        certificationExpiresAt: certificationExpiresAt ? new Date(certificationExpiresAt) : null,
        isSupervisor: !!isSupervisor,
        preferredRegions: preferredRegions?.trim() || null,
        notes: notes?.trim() || null,
        status: status?.trim() || null,
      },
    })

    // Ensure an Employee + primary EmployeeRole exists for this BCBA (additive, no impact on existing flows)
    await ensureEmployeeForBcbaProfile(profile.id)

    if (profile.email) {
      const { subject, html } = generateTeamWelcomeEmail(profile.fullName, 'BCBA')
      await sendGenericEmail(profile.email, subject, html)
    }

    return NextResponse.json({ id: profile.id, success: true })
  } catch (error) {
    console.error('Error creating BCBA:', error)
    return NextResponse.json({ error: 'Failed to create BCBA' }, { status: 500 })
  }
}

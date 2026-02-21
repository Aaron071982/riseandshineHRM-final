import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

    return NextResponse.json({ id: profile.id, success: true })
  } catch (error) {
    console.error('Error creating BCBA:', error)
    return NextResponse.json({ error: 'Failed to create BCBA' }, { status: 500 })
  }
}

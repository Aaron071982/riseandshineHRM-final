import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.session.updateMany({
      where: { token: sessionToken },
      data: {
        lastActiveAt: new Date(),
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          undefined,
      },
    })

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: true,
        sessions: {
          orderBy: { lastActiveAt: 'desc' },
        },
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const sessions = dbUser.sessions.map((session) => ({
      id: session.id,
      device: session.device,
      browser: session.browser,
      ipAddress: session.ipAddress,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.token === sessionToken,
    }))

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        phoneNumber: dbUser.phoneNumber,
        role: dbUser.role,
        isActive: dbUser.isActive,
      },
      profile: dbUser.profile,
      sessions,
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const data = {
      fullName: body.fullName || null,
      preferredName: body.preferredName || null,
      phone: body.phone || null,
      address: body.address || null,
      timezone: body.timezone || null,
      preferredContactMethod: body.preferredContactMethod || null,
      bio: body.bio || null,
      skills: normalizeStringArray(body.skills),
      languages: normalizeStringArray(body.languages),
      emergencyContactName: body.emergencyContactName || null,
      emergencyContactRelationship: body.emergencyContactRelationship || null,
      emergencyContactPhone: body.emergencyContactPhone || null,
      employeeId: body.employeeId || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      department: body.department || null,
      title: body.title || null,
      rbtCertificationNumber: body.rbtCertificationNumber || null,
      rbtCertificationExpiresAt: body.rbtCertificationExpiresAt
        ? new Date(body.rbtCertificationExpiresAt)
        : null,
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: data,
      create: {
        userId: user.id,
        ...data,
      },
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

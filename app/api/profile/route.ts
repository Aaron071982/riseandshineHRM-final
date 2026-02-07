import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { validateSession } from '@/lib/auth'

const LOG = (msg: string, data?: object) =>
  console.log('[auth][profile]', msg, data ?? '')

export async function GET(request: NextRequest) {
  const logId = `req_${Date.now().toString(36)}`
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      LOG(`${logId} no session cookie`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      LOG(`${logId} validateSession returned null`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    LOG(`${logId} session valid`, { userId: user.id })
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
      LOG(`${logId} user not found in DB`, { userId: user.id })
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    LOG(`${logId} success`, { userId: dbUser.id, role: dbUser.role })

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
  } catch (error: unknown) {
    const err = error as Error & { code?: string; meta?: unknown }
    console.error('[auth][profile] GET error', {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      stack: err?.stack?.split('\n').slice(0, 6),
    })
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

    const themePreference = body.themePreference
    const validTheme = themePreference === 'light' || themePreference === 'dark' || themePreference === 'system'
      ? themePreference
      : undefined

    const existing = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    })

    const data = {
      fullName: body.fullName !== undefined ? body.fullName || null : existing?.fullName ?? null,
      preferredName: body.preferredName !== undefined ? body.preferredName || null : existing?.preferredName ?? null,
      phone: body.phone !== undefined ? body.phone || null : existing?.phone ?? null,
      address: body.address !== undefined ? body.address || null : existing?.address ?? null,
      timezone: body.timezone !== undefined ? body.timezone || null : existing?.timezone ?? null,
      preferredContactMethod: body.preferredContactMethod !== undefined ? body.preferredContactMethod || null : existing?.preferredContactMethod ?? null,
      bio: body.bio !== undefined ? body.bio || null : existing?.bio ?? null,
      skills: body.skills !== undefined ? normalizeStringArray(body.skills) : existing?.skills ?? [],
      languages: body.languages !== undefined ? normalizeStringArray(body.languages) : existing?.languages ?? [],
      emergencyContactName: body.emergencyContactName !== undefined ? body.emergencyContactName || null : existing?.emergencyContactName ?? null,
      emergencyContactRelationship: body.emergencyContactRelationship !== undefined ? body.emergencyContactRelationship || null : existing?.emergencyContactRelationship ?? null,
      emergencyContactPhone: body.emergencyContactPhone !== undefined ? body.emergencyContactPhone || null : existing?.emergencyContactPhone ?? null,
      employeeId: body.employeeId !== undefined ? body.employeeId || null : existing?.employeeId ?? null,
      startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : existing?.startDate ?? null,
      department: body.department !== undefined ? body.department || null : existing?.department ?? null,
      title: body.title !== undefined ? body.title || null : existing?.title ?? null,
      rbtCertificationNumber: body.rbtCertificationNumber !== undefined ? body.rbtCertificationNumber || null : existing?.rbtCertificationNumber ?? null,
      rbtCertificationExpiresAt: body.rbtCertificationExpiresAt !== undefined
        ? (body.rbtCertificationExpiresAt ? new Date(body.rbtCertificationExpiresAt) : null)
        : existing?.rbtCertificationExpiresAt ?? null,
      themePreference: validTheme !== undefined ? validTheme : existing?.themePreference ?? null,
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: data,
      create: {
        userId: user.id,
        ...data,
      },
    })

    // Track form submission
    try {
      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        null

      await prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: 'FORM_SUBMISSION',
          action: 'Updated profile',
          resourceType: 'UserProfile',
          resourceId: profile.id,
          ipAddress,
          userAgent: request.headers.get('user-agent') || null,
          metadata: {
            updatedFields: Object.keys(data),
          },
        },
      })
    } catch (error) {
      console.error('Failed to track profile update:', error)
    }

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

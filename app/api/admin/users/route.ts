import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user
    if (!user || !isSuperAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      // Get all users with their latest activity and stats
      const users = await prisma.user.findMany({
        include: {
          profile: true,
          sessions: {
            where: {
              expiresAt: {
                gt: new Date(),
              },
            },
            orderBy: {
              lastActiveAt: 'desc',
            },
            take: 1,
          },
          activities: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
          _count: {
            select: {
              activities: true,
              sessions: {
                where: {
                  expiresAt: {
                    gt: new Date(),
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      // Get last login and last activity for each user
      const usersWithStats = await Promise.all(
        users.map(async (u) => {
          const lastLogin = await prisma.activityLog.findFirst({
            where: {
              userId: u.id,
              activityType: 'LOGIN',
            },
            orderBy: {
              createdAt: 'desc',
            },
          })

          const lastActivity = await prisma.activityLog.findFirst({
            where: {
              userId: u.id,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })

          return {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            isActive: u.isActive,
            createdAt: u.createdAt,
            profile: u.profile,
            lastLogin: lastLogin?.createdAt || null,
            lastActivity: lastActivity?.createdAt || null,
            totalActivities: u._count.activities,
            activeSessions: u._count.sessions,
          }
        })
      )

      return NextResponse.json({ users: usersWithStats })
    } catch (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ users: [] })
    }
  } catch (error) {
    console.error('Admin users GET error:', error)
    return NextResponse.json({ error: 'Unauthorized or forbidden' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user
    if (!user || !isSuperAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, fullName } = body
    const trimmedEmail = typeof email === 'string' ? email.trim() : ''
    const trimmedName = typeof fullName === 'string' ? fullName.trim() : ''

    if (!trimmedEmail || !trimmedName) {
      return NextResponse.json({ error: 'Email and full name are required' }, { status: 400 })
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: trimmedEmail, mode: 'insensitive' } },
    })

    if (existingUser?.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'This email is already an admin' },
        { status: 400 }
      )
    }

    if (existingUser) {
      const promotedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email: trimmedEmail,
          name: trimmedName,
          role: 'ADMIN',
          isActive: true,
        },
        include: { profile: true },
      })

      await prisma.userProfile.upsert({
        where: { userId: existingUser.id },
        update: { fullName: trimmedName },
        create: {
          userId: existingUser.id,
          fullName: trimmedName,
          timezone: 'America/New_York',
          skills: [],
          languages: [],
        },
      })

      try {
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            activityType: 'FORM_SUBMISSION',
            action: `Promoted existing user to admin: ${trimmedEmail}`,
            resourceType: 'User',
            resourceId: promotedUser.id,
            metadata: {
              createdUserEmail: trimmedEmail,
              createdUserName: trimmedName,
              previousRole: existingUser.role,
            },
          },
        })
      } catch (error) {
        console.error('Failed to track admin promotion:', error)
      }

      return NextResponse.json({ user: promotedUser, promoted: true }, { status: 200 })
    }

    const newUser = await prisma.user.create({
      data: {
        email: trimmedEmail,
        name: trimmedName,
        role: 'ADMIN',
        isActive: true,
        profile: {
          create: {
            fullName: trimmedName,
            timezone: 'America/New_York',
            skills: [],
            languages: [],
          },
        },
      },
      include: {
        profile: true,
      },
    })

    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: 'FORM_SUBMISSION',
          action: `Created admin user: ${trimmedEmail}`,
          resourceType: 'User',
          resourceId: newUser.id,
          metadata: {
            createdUserEmail: trimmedEmail,
            createdUserName: trimmedName,
          },
        },
      })
    } catch (error) {
      console.error('Failed to track admin creation:', error)
    }

    return NextResponse.json({ user: newUser }, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating admin user:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to create admin user'
    const prismaCode = error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : null
    if (prismaCode === 'P2002') {
      return NextResponse.json({ error: 'A user with this email or phone number already exists' }, { status: 400 })
    }
    return NextResponse.json(
      { error: message || 'Failed to create admin user' },
      { status: 500 },
    )
  }
}

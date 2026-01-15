import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

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
    if (!user || !isSuperAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        sessions: {
          where: {
            expiresAt: {
              gt: new Date(),
            },
          },
        },
        activities: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        _count: {
          select: {
            activities: true,
          },
        },
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: targetUser,
      activitySummary: {
        totalActivities: targetUser._count.activities,
        recentActivities: targetUser.activities,
      },
    })
  } catch (error) {
    console.error('Error fetching user details:', error)
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 })
  }
}

export async function PATCH(
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
    if (!user || !isSuperAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Update user
    const userUpdate: any = {}
    if (body.role !== undefined) userUpdate.role = body.role
    if (body.isActive !== undefined) userUpdate.isActive = body.isActive

    const updatedUser = await prisma.user.update({
      where: { id },
      data: userUpdate,
      include: {
        profile: true,
      },
    })

    // Update profile if provided
    if (body.profile) {
      await prisma.userProfile.upsert({
        where: { userId: id },
        update: body.profile,
        create: {
          userId: id,
          ...body.profile,
        },
      })
    }

    // Track update
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: 'FORM_SUBMISSION',
          action: `Updated user: ${updatedUser.email}`,
          resourceType: 'User',
          resourceId: id,
          metadata: {
            updatedFields: Object.keys(body),
          },
        },
      })
    } catch (error) {
      console.error('Failed to track user update:', error)
    }

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

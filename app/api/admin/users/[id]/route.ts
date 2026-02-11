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

export async function DELETE(
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

    // Prevent deleting yourself
    if (id === user.id) {
      return NextResponse.json({ error: 'You cannot remove your own admin access' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only allow removing admin role, not deleting the user
    if (targetUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'User is not an admin' }, { status: 400 })
    }

    // Change role to CANDIDATE instead of deleting
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: 'CANDIDATE',
      },
    })

    // Track removal
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          activityType: 'FORM_SUBMISSION',
          action: `Removed admin access for: ${targetUser.email}`,
          resourceType: 'User',
          resourceId: id,
          metadata: {
            removedUserEmail: targetUser.email,
            previousRole: 'ADMIN',
            newRole: 'CANDIDATE',
          },
        },
      })
    } catch (error) {
      console.error('Failed to track admin removal:', error)
    }

    return NextResponse.json({ 
      message: 'Admin access removed successfully',
      user: updatedUser 
    })
  } catch (error) {
    console.error('Error removing admin:', error)
    return NextResponse.json({ error: 'Failed to remove admin' }, { status: 500 })
  }
}

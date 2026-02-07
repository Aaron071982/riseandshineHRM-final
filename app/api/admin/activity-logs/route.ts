import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const userId = searchParams.get('userId')
    const activityType = searchParams.get('activityType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    try {
      // Build where clause
      const where: any = {}

      if (userId) {
        where.userId = userId
      }

      if (activityType) {
        where.activityType = activityType
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) {
          where.createdAt.gte = new Date(startDate)
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate)
        }
      }

      if (search) {
        where.OR = [
          { action: { contains: search, mode: 'insensitive' } },
          { resourceType: { contains: search, mode: 'insensitive' } },
          { url: { contains: search, mode: 'insensitive' } },
        ]
      }

      // Get total count
      const total = await prisma.activityLog.count({ where })

      // Get activities
      const activities = await prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      })

      return NextResponse.json({
        activities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      return NextResponse.json({
        activities: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      })
    }
  } catch (error) {
    console.error('Admin activity-logs GET error:', error)
    return NextResponse.json({ error: 'Unauthorized or forbidden' }, { status: 401 })
  }
}

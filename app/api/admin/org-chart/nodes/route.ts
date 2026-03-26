import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { defaultAvatarColorForDepartment } from '@/lib/org-chart-departments'

export const dynamic = 'force-dynamic'

function isUnknownSubDepartmentArg(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? '')
  const lower = msg.toLowerCase()
  return lower.includes('unknown argument') && lower.includes('subdepartment')
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const department = typeof body.department === 'string' ? body.department.trim() || null : null
    const subDepartment = typeof body.subDepartment === 'string' ? body.subDepartment.trim() || null : null
    const email = typeof body.email === 'string' ? body.email.trim() || null : null
    const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null
    const parentId = typeof body.parentId === 'string' ? body.parentId : null
    const linkedUserId = typeof body.linkedUserId === 'string' ? body.linkedUserId : null
    const sortOrder = typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder) ? body.sortOrder : 0
    let avatarColor =
      typeof body.avatarColor === 'string' && body.avatarColor.trim() ? body.avatarColor.trim() : defaultAvatarColorForDepartment(department)

    if (!name || !title) {
      return NextResponse.json({ error: 'name and title are required' }, { status: 400 })
    }

    if (parentId) {
      const parent = await prisma.orgNode.findUnique({ where: { id: parentId } })
      if (!parent) {
        return NextResponse.json({ error: 'Invalid parentId' }, { status: 400 })
      }
    }

    if (linkedUserId) {
      const u = await prisma.user.findUnique({ where: { id: linkedUserId } })
      if (!u) {
        return NextResponse.json({ error: 'Invalid linkedUserId' }, { status: 400 })
      }
    }

    let node
    try {
      node = await prisma.orgNode.create({
        data: {
          name,
          title,
          department,
          subDepartment,
          email,
          phone,
          parentId,
          linkedUserId,
          sortOrder,
          avatarColor,
        },
        include: {
          linkedUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              rbtProfile: { select: { id: true } },
            },
          },
        },
      })
    } catch (e) {
      if (!isUnknownSubDepartmentArg(e)) throw e
      // Backward-compat: server is running with older Prisma client / DB shape.
      node = await prisma.orgNode.create({
        data: {
          name,
          title,
          department,
          email,
          phone,
          parentId,
          linkedUserId,
          sortOrder,
          avatarColor,
        },
        include: {
          linkedUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              rbtProfile: { select: { id: true } },
            },
          },
        },
      })
    }

    return NextResponse.json({ node })
  } catch (e) {
    console.error('POST /api/admin/org-chart/nodes', e)
    return NextResponse.json({ error: 'Failed to create node' }, { status: 500 })
  }
}

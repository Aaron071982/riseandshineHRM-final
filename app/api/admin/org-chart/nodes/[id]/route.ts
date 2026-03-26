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

function wouldCreateCycle(flat: Array<{ id: string; parentId: string | null }>, nodeId: string, newParentId: string | null): boolean {
  if (!newParentId) return false
  let current: string | null = newParentId
  const byId = new Map(flat.map((n) => [n.id, n]))
  while (current) {
    if (current === nodeId) return true
    const nextParent: string | null = byId.get(current)?.parentId ?? null
    current = nextParent
  }
  return false
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    const existing = await prisma.orgNode.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))

    const all = await prisma.orgNode.findMany({ select: { id: true, parentId: true } })

    const patch: {
      name?: string
      title?: string
      department?: string | null
      subDepartment?: string | null
      email?: string | null
      phone?: string | null
      parentId?: string | null
      linkedUserId?: string | null
      sortOrder?: number
      avatarColor?: string
      isActive?: boolean
    } = {}

    if (typeof body.name === 'string') patch.name = body.name.trim()
    if (typeof body.title === 'string') patch.title = body.title.trim()
    if (body.department === null || typeof body.department === 'string') {
      patch.department = typeof body.department === 'string' ? body.department.trim() || null : null
    }
    if (body.subDepartment === null || typeof body.subDepartment === 'string') {
      patch.subDepartment = typeof body.subDepartment === 'string' ? body.subDepartment.trim() || null : null
    }
    if (body.email === null || typeof body.email === 'string') {
      patch.email = typeof body.email === 'string' ? body.email.trim() || null : null
    }
    if (body.phone === null || typeof body.phone === 'string') {
      patch.phone = typeof body.phone === 'string' ? body.phone.trim() || null : null
    }
    if (body.linkedUserId === null || typeof body.linkedUserId === 'string') {
      patch.linkedUserId = typeof body.linkedUserId === 'string' ? body.linkedUserId : null
    }
    if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
      patch.sortOrder = body.sortOrder
    }
    if (typeof body.avatarColor === 'string' && body.avatarColor.trim()) {
      patch.avatarColor = body.avatarColor.trim()
    }
    if (typeof body.isActive === 'boolean') {
      patch.isActive = body.isActive
    }

    if (body.parentId !== undefined) {
      const newParentId = body.parentId === null ? null : typeof body.parentId === 'string' ? body.parentId : undefined
      if (newParentId !== undefined) {
        if (newParentId === id) {
          return NextResponse.json({ error: 'Cannot set parent to self' }, { status: 400 })
        }
        if (newParentId) {
          const parent = await prisma.orgNode.findUnique({ where: { id: newParentId } })
          if (!parent) {
            return NextResponse.json({ error: 'Invalid parentId' }, { status: 400 })
          }
        }
        if (wouldCreateCycle(all, id, newParentId)) {
          return NextResponse.json({ error: 'Cannot move node: would create a cycle' }, { status: 400 })
        }
        patch.parentId = newParentId
      }
    }

    if (patch.name !== undefined && !patch.name) {
      return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    }
    if (patch.title !== undefined && !patch.title) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    }

    if (patch.linkedUserId) {
      const u = await prisma.user.findUnique({ where: { id: patch.linkedUserId } })
      if (!u) {
        return NextResponse.json({ error: 'Invalid linkedUserId' }, { status: 400 })
      }
    }

    if (patch.department !== undefined && patch.avatarColor === undefined) {
      patch.avatarColor = defaultAvatarColorForDepartment(patch.department)
    }

    let node
    try {
      node = await prisma.orgNode.update({
        where: { id },
        data: patch,
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
      const { subDepartment: _ignoreSubDepartment, ...patchWithoutSub } = patch
      node = await prisma.orgNode.update({
        where: { id },
        data: patchWithoutSub,
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
    console.error('PATCH /api/admin/org-chart/nodes/[id]', e)
    return NextResponse.json({ error: 'Failed to update node' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession()
  if (auth.response) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    const node = await prisma.orgNode.findUnique({ where: { id } })
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    const promoteTo = node.parentId

    await prisma.$transaction(async (tx) => {
      await tx.orgNode.updateMany({
        where: { parentId: id },
        data: { parentId: promoteTo },
      })
      await tx.orgNode.delete({ where: { id } })
    })

    const nodes = await prisma.orgNode.findMany({
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
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

    return NextResponse.json({ success: true, nodes })
  } catch (e) {
    console.error('DELETE /api/admin/org-chart/nodes/[id]', e)
    return NextResponse.json({ error: 'Failed to delete node' }, { status: 500 })
  }
}

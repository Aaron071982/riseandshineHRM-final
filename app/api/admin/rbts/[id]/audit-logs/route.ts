import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { parseLocalTimeAsNY } from '@/lib/utils'

// GET - Fetch all audit logs for an RBT
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    let auditLogs: Array<{ id: string; rbtProfileId: string; auditType: string; dateTime: Date; notes: string | null; createdBy: string | null; createdAt: Date; updatedAt: Date }>
    try {
      auditLogs = await prisma.rBTAuditLog.findMany({
        where: { rbtProfileId: id },
        orderBy: { dateTime: 'desc' },
      })
    } catch (err) {
      console.error('Error fetching audit logs (Prisma), retrying once then raw SQL', err)
      try {
        auditLogs = await prisma.rBTAuditLog.findMany({
          where: { rbtProfileId: id },
          orderBy: { dateTime: 'desc' },
        })
      } catch (retryErr) {
        try {
          const rows = await prisma.$queryRaw<
            Array<{ id: string; rbtProfileId: string; auditType: string; dateTime: Date; notes: string | null; createdBy: string | null; createdAt: Date; updatedAt: Date }>
          >`
            SELECT id, "rbtProfileId", "auditType", "dateTime", notes, "createdBy", "createdAt", "updatedAt"
            FROM rbt_audit_logs WHERE "rbtProfileId" = ${id} ORDER BY "dateTime" DESC
          `
          auditLogs = rows || []
        } catch (rawErr) {
          console.error('Error fetching audit logs (raw)', rawErr)
          return NextResponse.json(
            { error: 'Failed to fetch audit logs' },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json(auditLogs)
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

// POST - Create a new audit log
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const body = await request.json()
    const { auditType, dateTime, notes, createdBy } = body

    if (!auditType || !dateTime) {
      return NextResponse.json(
        { error: 'auditType and dateTime are required' },
        { status: 400 }
      )
    }

    // Verify RBT profile exists
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
    })

    if (!rbtProfile) {
      return NextResponse.json(
        { error: 'RBT profile not found' },
        { status: 404 }
      )
    }

    const auditLog = await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: id,
        auditType,
        dateTime: typeof dateTime === 'string' && dateTime.length <= 20 ? parseLocalTimeAsNY(dateTime) : new Date(dateTime),
        notes: notes || null,
        createdBy: createdBy || user.email || user.name || 'Admin',
      },
    })

    return NextResponse.json(auditLog, { status: 201 })
  } catch (error) {
    console.error('Error creating audit log:', error)
    return NextResponse.json(
      { error: 'Failed to create audit log' },
      { status: 500 }
    )
  }
}

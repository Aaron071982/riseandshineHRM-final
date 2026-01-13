import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

// GET - Fetch all audit logs for an RBT
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const auditLogs = await prisma.rBTAuditLog.findMany({
      where: { rbtProfileId: id },
      orderBy: { dateTime: 'desc' },
    })

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
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
        dateTime: new Date(dateTime),
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

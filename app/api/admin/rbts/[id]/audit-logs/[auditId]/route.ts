import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'
import { parseLocalTimeAsNY } from '@/lib/utils'

// DELETE - Delete an audit log
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const { id, auditId } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    // Verify the audit log belongs to this RBT
    const auditLog = await prisma.rBTAuditLog.findUnique({
      where: { id: auditId },
    })

    if (!auditLog || auditLog.rbtProfileId !== id) {
      return NextResponse.json(
        { error: 'Audit log not found' },
        { status: 404 }
      )
    }

    await prisma.rBTAuditLog.delete({
      where: { id: auditId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting audit log:', error)
    return NextResponse.json(
      { error: 'Failed to delete audit log' },
      { status: 500 }
    )
  }
}

// PATCH - Update an audit log
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auditId: string }> }
) {
  try {
    const { id, auditId } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    // Verify the audit log belongs to this RBT
    const auditLog = await prisma.rBTAuditLog.findUnique({
      where: { id: auditId },
    })

    if (!auditLog || auditLog.rbtProfileId !== id) {
      return NextResponse.json(
        { error: 'Audit log not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { auditType, dateTime, notes } = body

    const updatedAuditLog = await prisma.rBTAuditLog.update({
      where: { id: auditId },
      data: {
        ...(auditType && { auditType }),
        ...(dateTime && {
          dateTime: typeof dateTime === 'string' && dateTime.length <= 20 ? parseLocalTimeAsNY(dateTime) : new Date(dateTime),
        }),
        ...(notes !== undefined && { notes }),
      },
    })

    return NextResponse.json(updatedAuditLog)
  } catch (error) {
    console.error('Error updating audit log:', error)
    return NextResponse.json(
      { error: 'Failed to update audit log' },
      { status: 500 }
    )
  }
}

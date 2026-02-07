import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function DELETE(
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

    // Find the RBT profile
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
      include: {
        user: true,
      },
    })

    if (!rbtProfile) {
      return NextResponse.json({ error: 'RBT profile not found' }, { status: 404 })
    }

    const candidateLabel = `${rbtProfile.firstName} ${rbtProfile.lastName} (${rbtProfile.email || rbtProfile.phoneNumber})`
    await prisma.rBTAuditLog.create({
      data: {
        rbtProfileId: id,
        auditType: 'RBT_DELETED',
        dateTime: new Date(),
        notes: `RBT permanently deleted: ${candidateLabel}`,
        createdBy: user?.email || user?.name || 'Admin',
      },
    })

    // Delete the RBT profile first (cascade deletes related records including audit logs - so audit must be created before)
    await prisma.rBTProfile.delete({
      where: { id },
    })

    // Delete the user account
    await prisma.user.delete({
      where: { id: rbtProfile.userId },
    }).catch((error) => {
      // If user already deleted by cascade, that's fine
      console.log('User may have been deleted by cascade:', error.message)
    })

    return NextResponse.json({ success: true, message: 'RBT deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting RBT:', error)
    return NextResponse.json(
      { error: 'Failed to delete RBT: ' + error.message },
      { status: 500 }
    )
  }
}


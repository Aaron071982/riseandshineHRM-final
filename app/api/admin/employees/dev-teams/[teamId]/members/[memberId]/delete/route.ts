import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  try {
    const { teamId, memberId } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const member = await prisma.devTeamMember.findFirst({
      where: { id: memberId, devTeamId: teamId },
    })
    if (!member) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })

    await prisma.staffHoursLog.deleteMany({
      where: { employeeType: 'DEV_TEAM_MEMBER', referenceId: memberId },
    })
    await prisma.devTeamMember.delete({ where: { id: memberId } })

    return NextResponse.json({ success: true, message: 'Team member deleted successfully' })
  } catch (error: unknown) {
    console.error('Error deleting dev team member:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete team member' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const team = await prisma.devTeam.findUnique({
      where: { id: teamId },
      include: { members: true },
    })
    if (!team) return NextResponse.json({ error: 'Dev team not found' }, { status: 404 })

    for (const member of team.members) {
      await prisma.staffHoursLog.deleteMany({
        where: { employeeType: 'DEV_TEAM_MEMBER', referenceId: member.id },
      })
    }
    await prisma.devTeam.delete({ where: { id: teamId } })

    return NextResponse.json({ success: true, message: 'Dev team deleted successfully' })
  } catch (error: unknown) {
    console.error('Error deleting dev team:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete dev team' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

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

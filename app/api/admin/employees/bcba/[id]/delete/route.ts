import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const profile = await prisma.bCBAProfile.findUnique({ where: { id } })
    if (!profile) return NextResponse.json({ error: 'BCBA profile not found' }, { status: 404 })

    await prisma.staffHoursLog.deleteMany({
      where: { employeeType: 'BCBA', referenceId: id },
    })
    await prisma.bCBAProfile.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'BCBA deleted successfully' })
  } catch (error: unknown) {
    console.error('Error deleting BCBA:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete BCBA' },
      { status: 500 }
    )
  }
}

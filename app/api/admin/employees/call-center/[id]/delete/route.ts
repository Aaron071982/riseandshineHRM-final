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

    const profile = await prisma.callCenterProfile.findUnique({ where: { id } })
    if (!profile) return NextResponse.json({ error: 'Call center profile not found' }, { status: 404 })

    await prisma.staffHoursLog.deleteMany({
      where: { employeeType: 'CALL_CENTER', referenceId: id },
    })
    await prisma.callCenterProfile.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Call center profile deleted successfully' })
  } catch (error: unknown) {
    console.error('Error deleting call center profile:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete call center profile' },
      { status: 500 }
    )
  }
}

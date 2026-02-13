import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/admin/scheduling-beta/clients/[id]
 * Delete a scheduling client. Assignments to this client are removed (CASCADE).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    await prisma.schedulingClient.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[scheduling-beta] DELETE client error:', e)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }
}

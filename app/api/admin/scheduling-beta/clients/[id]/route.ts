import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
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
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const { id } = await params
    await prisma.schedulingClient.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[scheduling-beta] DELETE client error:', e)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }
}

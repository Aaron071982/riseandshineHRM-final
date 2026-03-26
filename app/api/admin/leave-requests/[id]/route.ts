import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    const { status, adminNotes } = await request.json()

    await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        adminNotes: adminNotes || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating leave request:', error)
    return NextResponse.json(
      { error: 'Failed to update leave request' },
      { status: 500 }
    )
  }
}


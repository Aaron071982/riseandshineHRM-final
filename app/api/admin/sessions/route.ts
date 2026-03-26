import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

    await prisma.session.deleteMany({})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error signing out all users:', error)
    return NextResponse.json({ error: 'Failed to sign out users' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { name, description } = body as { name?: string; description?: string }

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    const team = await prisma.devTeam.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    })

    return NextResponse.json({ id: team.id, success: true })
  } catch (error) {
    console.error('Error creating Dev team:', error)
    return NextResponse.json({ error: 'Failed to create dev team' }, { status: 500 })
  }
}

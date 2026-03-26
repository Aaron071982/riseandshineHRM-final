import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user

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

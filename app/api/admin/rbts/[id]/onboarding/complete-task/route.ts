import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { taskId } = await request.json()

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      )
    }

    // Verify RBT profile exists
    const rbtProfile = await prisma.rBTProfile.findUnique({
      where: { id },
    })

    if (!rbtProfile) {
      return NextResponse.json(
        { error: 'RBT profile not found' },
        { status: 404 }
      )
    }

    // Verify task belongs to this RBT
    const task = await prisma.onboardingTask.findUnique({
      where: { id: taskId },
    })

    if (!task || task.rbtProfileId !== id) {
      return NextResponse.json(
        { error: 'Task not found or does not belong to this RBT' },
        { status: 404 }
      )
    }

    // Mark task as complete
    await prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, message: 'Task marked as complete' })
  } catch (error: any) {
    console.error('Error completing onboarding task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to complete task' },
      { status: 500 }
    )
  }
}


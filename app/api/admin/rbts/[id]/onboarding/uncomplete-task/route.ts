import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { id } = await params
    const { taskId } = await request.json()

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // Verify task belongs to this RBT profile
    const task = await prisma.onboardingTask.findUnique({
      where: { id: taskId },
      select: { id: true, rbtProfileId: true },
    })

    if (!task || task.rbtProfileId !== id) {
      return NextResponse.json({ error: 'Task not found or does not belong to this RBT' }, { status: 404 })
    }

    await prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        isCompleted: false,
        completedAt: null,
      },
    })

    return NextResponse.json({ success: true, message: 'Task reverted to pending' })
  } catch (error: any) {
    console.error('Error reverting onboarding task:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to revert task' },
      { status: 500 }
    )
  }
}


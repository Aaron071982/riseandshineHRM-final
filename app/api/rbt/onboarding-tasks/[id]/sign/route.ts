import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user || user.role !== 'RBT' || !user.rbtProfileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const task = await prisma.onboardingTask.findUnique({
      where: { id },
      include: { rbtProfile: true },
    })

    if (!task || task.rbtProfileId !== user.rbtProfileId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.taskType !== 'SIGNATURE') {
      return NextResponse.json(
        { error: 'This endpoint is only for signature tasks' },
        { status: 400 }
      )
    }

    const { signature } = await request.json()

    if (!signature || typeof signature !== 'string' || signature.trim().length === 0) {
      return NextResponse.json(
        { error: 'Signature is required' },
        { status: 400 }
      )
    }

    // Update task with signature
    await prisma.onboardingTask.update({
      where: { id },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        uploadUrl: signature, // Store signature in uploadUrl field for now
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error submitting signature:', error)
    return NextResponse.json(
      { error: 'Failed to submit signature' },
      { status: 500 }
    )
  }
}


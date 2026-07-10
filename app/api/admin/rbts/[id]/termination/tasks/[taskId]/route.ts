import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { completeOffboardingTask } from '@/lib/termination/finalize'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response
    const user = auth.user!

    const { taskId } = await params
    const body = await request.json().catch(() => ({}))
    const notes = typeof body?.notes === 'string' ? body.notes : undefined

    const task = await completeOffboardingTask(taskId, user.id, notes)
    return NextResponse.json({ success: true, task })
  } catch (error) {
    console.error('[termination/task]', error)
    return NextResponse.json({ error: 'Failed to update offboarding task' }, { status: 500 })
  }
}

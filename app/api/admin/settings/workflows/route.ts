import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { getWorkflowSettings, setWorkflowSettings, type WorkflowSettings } from '@/lib/workflow-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const settings = await getWorkflowSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('GET workflow settings:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const body = await request.json()

    const updates: Partial<WorkflowSettings> = {}

    if (typeof body.emailReachOut === 'boolean') updates.emailReachOut = body.emailReachOut
    if (typeof body.emailToInterview === 'boolean') updates.emailToInterview = body.emailToInterview
    if (typeof body.emailHired === 'boolean') updates.emailHired = body.emailHired
    if (typeof body.emailRejection === 'boolean') updates.emailRejection = body.emailRejection
    if (typeof body.notifyAdminsHired === 'boolean') updates.notifyAdminsHired = body.notifyAdminsHired
    if (typeof body.stalenessDigest === 'boolean') updates.stalenessDigest = body.stalenessDigest

    if (typeof body.stalenessDaysReachOut === 'number' && body.stalenessDaysReachOut > 0) {
      updates.stalenessDaysReachOut = body.stalenessDaysReachOut
    }
    if (typeof body.stalenessDaysToInterview === 'number' && body.stalenessDaysToInterview > 0) {
      updates.stalenessDaysToInterview = body.stalenessDaysToInterview
    }
    if (typeof body.stalenessDaysOnboarding === 'number' && body.stalenessDaysOnboarding > 0) {
      updates.stalenessDaysOnboarding = body.stalenessDaysOnboarding
    }

    if (Array.isArray(body.stalenessRecipients)) {
      const emails = body.stalenessRecipients.filter((e: unknown) => typeof e === 'string' && e.trim().length > 0).map((e: string) => e.trim().toLowerCase())
      const invalid = emails.filter((e: string) => !isValidEmail(e))
      if (invalid.length > 0) {
        return NextResponse.json({ error: `Invalid email(s): ${invalid.join(', ')}` }, { status: 400 })
      }
      updates.stalenessRecipients = emails
    } else if (typeof body.stalenessRecipients === 'string') {
      const emails = body.stalenessRecipients
        .split(/[,;\n]+/)
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean)
      const invalid = emails.filter((e: string) => !isValidEmail(e))
      if (invalid.length > 0) {
        return NextResponse.json({ error: `Invalid email(s): ${invalid.join(', ')}` }, { status: 400 })
      }
      updates.stalenessRecipients = emails
    }

    await setWorkflowSettings(updates)
    const settings = await getWorkflowSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('POST workflow settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}

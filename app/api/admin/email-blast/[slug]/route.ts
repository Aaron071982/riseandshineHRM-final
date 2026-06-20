import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth'
import { BT_THANK_YOU_CAMPAIGN } from '@/lib/email-blast/campaigns'
import { getEmailBlastPreview, sendEmailBlastCampaign } from '@/lib/email-blast/sendCampaign'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { slug } = await params
    if (slug !== BT_THANK_YOU_CAMPAIGN.slug) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const preview = await getEmailBlastPreview(slug)
    return NextResponse.json(preview)
  } catch (error: unknown) {
    console.error('[email-blast] preview failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load campaign preview' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await requireAdminSession()
    if (auth.response) return auth.response

    const { slug } = await params
    if (slug !== BT_THANK_YOU_CAMPAIGN.slug) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    if (body?.confirm !== true) {
      return NextResponse.json(
        { error: 'Confirmation required. Set confirm: true to send.' },
        { status: 400 }
      )
    }

    const result = await sendEmailBlastCampaign(slug, auth.user.id)
    const status = result.success ? 200 : result.message.includes('already sent') ? 409 : 400
    return NextResponse.json(result, { status })
  } catch (error: unknown) {
    console.error('[email-blast] send failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send campaign' },
      { status: 500 }
    )
  }
}

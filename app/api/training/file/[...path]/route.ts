import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSession } from '@/lib/auth'
import { TRAINING_MATERIALS_BUCKET } from '@/lib/constants'
import { fetchUserCrmRoles } from '@/lib/crm/access'
import {
  moduleAssignedToUser,
  userAudienceKeys,
} from '@/lib/org-training/audience'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params
  const storageObjectPath = parts.map(decodeURIComponent).join('/')
  if (!storageObjectPath || storageObjectPath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await validateSession(token)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const item = await prisma.orgTrainingModuleItem.findFirst({
    where: {
      type: 'FILE',
      storageObjectPath,
    },
    select: {
      module: {
        select: {
          id: true,
          status: true,
          audienceRoles: true,
        },
      },
    },
  })
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const allowedAdmin = (user.role ?? '').toUpperCase() === 'ADMIN'
  if (!allowedAdmin) {
    if (item.module.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const crmRoles = await fetchUserCrmRoles(user.id)
    const keys = userAudienceKeys({ role: user.role, crmRoles })
    if (!moduleAssignedToUser(item.module, keys)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from(TRAINING_MATERIALS_BUCKET)
    .createSignedUrl(storageObjectPath, 60 * 15)

  if (error || !data?.signedUrl) {
    console.error('[org-training file]', error)
    return NextResponse.json({ error: 'Failed to sign URL' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}

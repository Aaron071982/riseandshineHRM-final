import { NextResponse } from 'next/server'
import { requireAdminSession, resolveClientManagerAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Lightweight check for AdminLayout / UI gating (allowed: boolean only). */
export async function GET() {
  try {
    const auth = await requireAdminSession()
    if (auth.response) {
      return NextResponse.json({ allowed: false })
    }
    return NextResponse.json({ allowed: await resolveClientManagerAccess(auth.user) })
  } catch {
    return NextResponse.json({ allowed: false })
  }
}

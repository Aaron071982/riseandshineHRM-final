import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import {
  isParentFormSlug,
  PARENT_FORM_FILES,
  resolveParentFormPath,
} from '@/lib/crm/emails/parentFormDownloads'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public download for blank parent forms (Welcome Packet, Intake, Consent).
 * Allowlisted slugs only — no path traversal.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: raw } = await params
  const slug = raw?.trim().toLowerCase()
  if (!slug || !isParentFormSlug(slug)) {
    return NextResponse.json({ error: 'Unknown form' }, { status: 404 })
  }

  const meta = PARENT_FORM_FILES[slug]
  const full = resolveParentFormPath(meta.file)
  if (!full) {
    return NextResponse.json({ error: 'Form file not found' }, { status: 404 })
  }

  try {
    const buf = await readFile(full)
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buf.length),
        'Content-Disposition': `attachment; filename="${meta.file}"`,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not read form' }, { status: 500 })
  }
}

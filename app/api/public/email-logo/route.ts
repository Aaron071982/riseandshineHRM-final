import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public absolute logo for outbound parent emails.
 * Email clients fetch this URL without a session cookie.
 */
export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'new-real-logo.png')
  try {
    const buf = await readFile(filePath)
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new NextResponse('Logo not found', { status: 404 })
  }
}

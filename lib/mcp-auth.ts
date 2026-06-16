import { NextRequest, NextResponse } from 'next/server'

/**
 * MCP connector auth: Authorization: Bearer <MCP_API_KEY> must match env.
 * In production, MCP_API_KEY must be configured (otherwise endpoints return 503).
 */
export function assertMcpAuth(request: NextRequest): NextResponse | null {
  const MCP_API_KEY = process.env.MCP_API_KEY
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '') ?? ''
  const isProd = process.env.NODE_ENV === 'production'

  if (isProd) {
    if (!MCP_API_KEY) {
      return NextResponse.json({ error: 'MCP_API_KEY not configured' }, { status: 503 })
    }
    if (bearerToken !== MCP_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return null
  }

  if (MCP_API_KEY && bearerToken !== MCP_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

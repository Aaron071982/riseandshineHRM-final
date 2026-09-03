/**
 * MCP v1 scope — intentionally limited tool surface.
 *
 * ONLY these 5 tools exist (see lib/mcp/registry.ts):
 *   get_onboarding_status, get_pipeline_stats, find_idle_hires, lookup_bt, add_candidate_note
 *
 * EXCLUDED from v1 (no callable functions — add only after explicit review):
 *   - Sending emails or SMS
 *   - Deleting any records
 *   - Modifying documents or signatures
 *   - Changing pay rates or financial data
 *   - Modifying access controls or permissions
 *   - Bulk operations
 */
import { NextRequest, NextResponse } from 'next/server'
import { resolveMcpAuth } from '@/lib/mcp-auth'
import { runWithMcpAuth } from '@/lib/mcp/context'
import { handleMcpProtocolRequest } from '@/lib/mcp/httpHandler'
import { logMcpRequest, oauthOptionsResponse, withCors } from '@/lib/oauth/http'
import { getClientIpFromRequest } from '@/lib/client-ip'

export const runtime = 'nodejs'
export const maxDuration = 60

async function withCorsResponse(response: Response): Promise<Response> {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, MCP-Protocol-Version, mcp-session-id, Last-Event-ID'
  )
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const authResult = await resolveMcpAuth(request)
  if ('error' in authResult) {
    logMcpRequest(request, 'unauthorized')
    return authResult.error
  }

  logMcpRequest(request, 'authorized')

  const context = {
    ...authResult.context,
    requestIp: getClientIpFromRequest(request),
  }

  try {
    const response = await runWithMcpAuth(context, () =>
      handleMcpProtocolRequest(request)
    )
    return withCorsResponse(response)
  } catch (err) {
    console.error('[mcp] request failed:', err)
    return withCors(
      NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        },
        { status: 500 }
      )
    )
  }
}

export async function OPTIONS() {
  console.log('[mcp]', JSON.stringify({ method: 'OPTIONS', outcome: 'preflight' }))
  return oauthOptionsResponse()
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request)
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request)
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request)
}

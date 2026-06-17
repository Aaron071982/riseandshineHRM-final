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
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { assertMcpAuth } from '@/lib/mcp-auth'
import { createMcpServer } from '@/lib/mcp/server'
import { logMcpRequest, oauthOptionsResponse, withCors } from '@/lib/oauth/http'

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
  const denied = await assertMcpAuth(request)
  if (denied) {
    logMcpRequest(request, 'unauthorized')
    return denied
  }

  logMcpRequest(request, 'authorized')

  const transport = new WebStandardStreamableHTTPServerTransport()
  const server = createMcpServer()

  try {
    await server.connect(transport)
    const response = await transport.handleRequest(request)
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
  } finally {
    await server.close().catch(() => {})
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

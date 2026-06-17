import { NextRequest, NextResponse } from 'next/server'
import { makePublicUrl } from '@/lib/baseUrl'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, MCP-Protocol-Version, mcp-session-id, Last-Event-ID',
  'Access-Control-Max-Age': '86400',
}

export function getProtectedResourceMetadataUrl(): string {
  return makePublicUrl('/.well-known/oauth-protected-resource')
}

export function getWwwAuthenticateHeader(): string {
  return `Bearer resource_metadata="${getProtectedResourceMetadataUrl()}"`
}

export function logOAuthRoute(route: string, detail: Record<string, unknown>): void {
  console.log(`[oauth][${route}]`, JSON.stringify(detail))
}

export function withCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

export function oauthJsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(data, { status })
  withCors(response)
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      response.headers.set(key, value)
    }
  }
  return response
}

export function oauthOptionsResponse(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }))
}

export function mcpUnauthorizedResponse(reason = 'missing_or_invalid_token'): NextResponse {
  const body = { error: 'Unauthorized', error_description: reason }
  const response = NextResponse.json(body, {
    status: 401,
    headers: {
      'WWW-Authenticate': getWwwAuthenticateHeader(),
    },
  })
  return withCors(response)
}

export function logMcpRequest(request: NextRequest, outcome: string): void {
  console.log(
    '[mcp]',
    JSON.stringify({
      method: request.method,
      outcome,
      hasAuth: !!request.headers.get('authorization'),
      accept: request.headers.get('accept'),
    })
  )
}

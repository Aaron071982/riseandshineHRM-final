import { MCP_OAUTH_SCOPE, oauthEndpoints } from '@/lib/oauth/crypto'
import { logOAuthRoute, oauthJsonResponse, oauthOptionsResponse } from '@/lib/oauth/http'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  logOAuthRoute('protected-resource', { method: 'OPTIONS' })
  return oauthOptionsResponse()
}

export async function GET() {
  const endpoints = oauthEndpoints()
  const body = {
    resource: endpoints.mcp_resource,
    authorization_servers: [endpoints.issuer],
    bearer_methods_supported: ['header'],
    scopes_supported: MCP_OAUTH_SCOPE.split(/\s+/),
  }
  logOAuthRoute('protected-resource', { method: 'GET', resource: body.resource })
  return oauthJsonResponse(body)
}

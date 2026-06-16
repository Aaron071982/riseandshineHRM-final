import { NextResponse } from 'next/server'
import { oauthEndpoints } from '@/lib/oauth/crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  const endpoints = oauthEndpoints()
  return NextResponse.json({
    resource: endpoints.mcp_resource,
    authorization_servers: [endpoints.issuer],
  })
}

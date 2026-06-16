import { NextResponse } from 'next/server'
import { oauthEndpoints } from '@/lib/oauth/crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  const endpoints = oauthEndpoints()
  return NextResponse.json({
    issuer: endpoints.issuer,
    authorization_endpoint: endpoints.authorization_endpoint,
    token_endpoint: endpoints.token_endpoint,
    registration_endpoint: endpoints.registration_endpoint,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
  })
}

import crypto from 'crypto'
import { getPublicBaseUrl, makePublicUrl } from '@/lib/baseUrl'

export const MCP_OAUTH_SCOPE = 'mcp:read mcp:write'
export const ACCESS_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
export const AUTH_CODE_TTL_SECONDS = 60

export function getOAuthIssuer(): string {
  return getPublicBaseUrl()
}

export function oauthEndpoints() {
  const issuer = getOAuthIssuer()
  return {
    issuer,
    authorization_endpoint: makePublicUrl('/api/oauth/authorize'),
    token_endpoint: makePublicUrl('/api/oauth/token'),
    registration_endpoint: makePublicUrl('/api/oauth/register'),
    mcp_resource: makePublicUrl('/api/mcp'),
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function generateClientId(): string {
  return `mcp_${crypto.randomBytes(16).toString('hex')}`
}

export function generateClientSecret(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/** PKCE S256: BASE64URL(SHA256(code_verifier)) === code_challenge */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return timingSafeEqual(computed, codeChallenge)
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

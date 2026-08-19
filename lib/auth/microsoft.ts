import crypto from 'crypto'

export const MICROSOFT_GRAPH_TOKEN_COOKIE = 'ms_graph_delegated_token'
export const MICROSOFT_PKCE_COOKIE = 'ms_auth_pkce'
export const MICROSOFT_STATE_COOKIE = 'ms_auth_state'
export const MICROSOFT_NONCE_COOKIE = 'ms_auth_nonce'

const CALLBACK_PATH = '/api/auth/microsoft/callback'
const MICROSOFT_SCOPES = ['openid', 'profile', 'email', 'User.Read', 'Mail.Send'] as const

export type MicrosoftIdTokenClaims = {
  tid?: string
  upn?: string
  email?: string
  preferred_username?: string
  name?: string
  nonce?: string
}

export function microsoftAuthEnabled(): boolean {
  return process.env.MICROSOFT_AUTH_ENABLED === 'true'
}

export function getMicrosoftTenantId(): string {
  return (process.env.MICROSOFT_TENANT_ID ?? '').trim()
}

export function getMicrosoftClientId(): string {
  return (process.env.MICROSOFT_CLIENT_ID ?? '').trim()
}

export function getMicrosoftClientSecret(): string {
  return (process.env.MICROSOFT_CLIENT_SECRET ?? '').trim()
}

export function getMicrosoftScopes(): string[] {
  return [...MICROSOFT_SCOPES]
}

export function getMicrosoftRedirectUri(origin: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}${CALLBACK_PATH}`
}

export function getMicrosoftAuthorityBase(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecodeToString(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + pad, 'base64').toString('utf8')
}

export function generatePkceVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(32))
}

export function generatePkceChallenge(verifier: string): string {
  return base64UrlEncode(crypto.createHash('sha256').update(verifier).digest())
}

export function generateOAuthState(): string {
  return base64UrlEncode(crypto.randomBytes(24))
}

export function generateNonce(): string {
  return base64UrlEncode(crypto.randomBytes(24))
}

export function decodeMicrosoftIdTokenClaims(idToken: string): MicrosoftIdTokenClaims | null {
  const parts = idToken.split('.')
  if (parts.length < 2) return null
  try {
    const payloadRaw = base64UrlDecodeToString(parts[1] ?? '')
    return JSON.parse(payloadRaw) as MicrosoftIdTokenClaims
  } catch {
    return null
  }
}

export function normalizeMicrosoftEmail(claims: MicrosoftIdTokenClaims): string {
  const raw = claims.preferred_username ?? claims.email ?? claims.upn ?? ''
  return raw.trim().toLowerCase()
}

export function isRiseAndShineOrgEmail(email: string): boolean {
  return email.endsWith('@riseandshineaba.com')
}

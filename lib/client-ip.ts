import type { NextRequest } from 'next/server'

type HeaderSource = { get(name: string): string | null }

/**
 * Best-effort client IP for audit logs (proxies: first hop of x-forwarded-for).
 */
export function getClientIpFromHeaders(headers: HeaderSource): string | null {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const vercel = headers.get('x-vercel-forwarded-for')?.trim()
  if (vercel) return vercel.split(',')[0]?.trim() || vercel
  const cf = headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  return null
}

export function getClientIpFromRequest(request: NextRequest): string | null {
  return getClientIpFromHeaders(request.headers)
}

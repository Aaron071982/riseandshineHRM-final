import type { NextRequest } from 'next/server'

/**
 * Best-effort client IP for audit logs (proxies: first hop of x-forwarded-for).
 */
export function getClientIpFromRequest(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const vercel = request.headers.get('x-vercel-forwarded-for')?.trim()
  if (vercel) return vercel.split(',')[0]?.trim() || vercel
  const cf = request.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  return null
}

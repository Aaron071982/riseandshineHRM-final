import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public static assets (email clients + <img> tags must load without a session)
  if (/\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|css|js|map|txt|xml)$/i.test(pathname)) {
    return NextResponse.next()
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/verify-otp', '/login', '/apply', '/apply/success', '/schedule-interview']
  const publicApiRoutes = ['/api/auth/send-otp', '/api/auth/verify-otp', '/api/auth/get-latest-otp']
  
  // Allow public API routes for application submission
  if (pathname.startsWith('/api/public/')) {
    return NextResponse.next()
  }

  // Company document magic links (view / acknowledge without login)
  if (pathname.startsWith('/d/')) {
    return NextResponse.next()
  }

  // OAuth discovery + MCP must be reachable without a session cookie
  if (pathname.startsWith('/.well-known/')) {
    return NextResponse.next()
  }
  
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    // Other API routes will handle their own auth
    return NextResponse.next()
  }
  
  // For protected routes, just check if session cookie exists
  // Actual validation will happen in the route handlers/layouts
  const sessionToken = request.cookies.get('session')?.value

  if (!sessionToken) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Let the individual routes handle full validation
  // This middleware just ensures a session cookie exists
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image
     * - favicon / brand logos used in emails and UI
     * - common public static file extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|logo\\.png|new-real-logo\\.png|.*\\.(?:png|jpe?g|gif|webp|svg|ico)$).*)',
  ],
}


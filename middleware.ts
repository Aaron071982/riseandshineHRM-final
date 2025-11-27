import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/verify-otp']
  const publicApiRoutes = ['/api/auth/send-otp', '/api/auth/verify-otp', '/api/auth/get-latest-otp']
  
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    // API routes will handle their own auth
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
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - logo.png (logo file)
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png).*)',
  ],
}


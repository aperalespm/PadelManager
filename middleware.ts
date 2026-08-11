import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect all /admin routes
  if (pathname.startsWith('/admin')) {
    const sessionCookie =
      request.cookies.get('neon-auth-session')?.value ||
      request.cookies.get('__session')?.value ||
      request.cookies.get('session')?.value

    // Check any auth-related cookie — Neon Auth sets its own cookie
    const hasAuthCookie = Array.from(request.cookies.getAll()).some(c =>
      c.name.includes('session') || c.name.includes('auth') || c.name.includes('token')
    )

    if (!hasAuthCookie) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}

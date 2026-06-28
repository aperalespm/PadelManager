import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-secret-change-in-production-min32chars!!'
)
const COOKIE_NAME = 'joypadel-session'

const PROTECTED_PREFIXES = ['/admin', '/torneos']
const AUTH_PAGES = ['/login', '/register', '/forgot-password']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isAuthPage = AUTH_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))

  const token = request.cookies.get(COOKIE_NAME)?.value
  let isAuthenticated = false

  if (token) {
    try {
      await jwtVerify(token, SECRET)
      isAuthenticated = true
    } catch {
      isAuthenticated = false
    }
  }

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/torneos', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/torneos',
    '/torneos/:path*',
    '/login',
    '/register',
    '/forgot-password',
  ],
}

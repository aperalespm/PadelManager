import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/t/',
  '/torneos',
  '/api/auth',
  '/api/webhooks',
  '/_next',
  '/favicon.ico',
  '/public',
]

const neonMiddleware = auth.middleware({ loginUrl: '/login' })

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }
  return neonMiddleware(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

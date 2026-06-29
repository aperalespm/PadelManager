import { auth } from '@/lib/auth'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const handler = auth.middleware({ loginUrl: '/login' })

export async function proxy(request: NextRequest) {
  // Server actions (Next-Action header) bypass middleware auth — the action validates
  // auth itself via requireOrganizer(). Neon Auth middleware uses plain HTTP redirects
  // which Next.js server action client doesn't recognize (expects x-action-redirect).
  if (request.headers.get('next-action')) {
    return NextResponse.next()
  }
  return handler(request)
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
}

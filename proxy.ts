import { auth } from '@/lib/auth'
import type { NextRequest } from 'next/server'

const handler = auth.middleware({ loginUrl: '/login' })

export async function proxy(request: NextRequest) {
  return handler(request)
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
}

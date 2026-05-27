import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth is handled per-page via auth.getSession() in each server component.
// This proxy only exists to pass requests through cleanly.
export function proxy(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

import { NextResponse } from 'next/server'

type AuthUser = { id: string; email: string; name: string | null }
type AuthSession = { user: AuthUser } | null

export const auth = {
  getSession: async (): Promise<{ data: AuthSession }> => ({ data: null }),
  handler: () => ({
    GET: async () => NextResponse.json({ error: 'Auth not configured' }, { status: 501 }),
    POST: async () => NextResponse.json({ error: 'Auth not configured' }, { status: 501 }),
  }),
}

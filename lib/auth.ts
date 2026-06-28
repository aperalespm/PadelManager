import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-secret-change-in-production-min32chars!!'
)
export const COOKIE_NAME = 'joypadel-session'

export type AuthUser = { id: string; email: string; name: string | null }

export async function getSession(): Promise<{ user: AuthUser } | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, SECRET)
    return { user: payload as unknown as AuthUser }
  } catch {
    return null
  }
}

export async function createSession(user: AuthUser): Promise<void> {
  const token = await new SignJWT({ id: user.id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(SECRET)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// Compat shim for existing code that calls auth.getSession()
export const auth = {
  getSession: async (): Promise<{ data: { user: AuthUser } | null }> => {
    const session = await getSession()
    return { data: session }
  },
}

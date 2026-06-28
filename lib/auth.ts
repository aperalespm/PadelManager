import { createNeonAuth } from '@neondatabase/auth/next/server'

export type AuthUser = { id: string; email: string; name: string | null }

// Fallback values let the build succeed when env vars aren't available at bundle time.
// At runtime, the actual env vars are always present.
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || 'https://placeholder.neonauth.neon.tech',
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET || 'placeholder-build-secret-32-chars-minimum',
  },
})

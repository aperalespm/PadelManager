import { createAuthClient } from '@neondatabase/auth'

export const authClient = createAuthClient(process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL!)

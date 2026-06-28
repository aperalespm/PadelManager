import { createAuthClient } from '@neondatabase/auth'

// Route auth calls through our own /api/auth/* proxy instead of calling
// Neon Auth directly — avoids CORS issues and keeps NEON_AUTH_BASE_URL server-only.
const appUrl =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const authClient = createAuthClient(appUrl)

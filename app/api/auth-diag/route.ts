import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const baseUrl = process.env.NEON_AUTH_BASE_URL ?? '(not set)'
  const secret = process.env.NEON_AUTH_COOKIE_SECRET ? `set (${process.env.NEON_AUTH_COOKIE_SECRET.length} chars)` : '(not set)'
  const origin = new URL(request.url).origin

  // Probe the sign-up endpoint with Origin header (like the real proxy does)
  let probeStatus: number | string = 'not tested'
  let probeBody: string = ''
  try {
    const url = `${process.env.NEON_AUTH_BASE_URL}/sign-up/email`
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin,
        'x-neon-auth-middleware': 'true',
      },
      body: JSON.stringify({ email: 'diag@test.invalid', password: 'diag1234test', name: 'diag' }),
    })
    probeStatus = r.status
    probeBody = await r.text().catch(() => '(unreadable)')
  } catch (e: unknown) {
    probeStatus = 'fetch threw'
    probeBody = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    baseUrl,
    secret,
    origin,
    probeUrl: `${baseUrl}/sign-up/email`,
    probeStatus,
    probeBody: probeBody.slice(0, 800),
  })
}

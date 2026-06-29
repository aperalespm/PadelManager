import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL ?? '(not set)'
  const secret = process.env.NEON_AUTH_COOKIE_SECRET ? `set (${process.env.NEON_AUTH_COOKIE_SECRET.length} chars)` : '(not set)'

  // Probe the sign-up endpoint
  let probeStatus: number | string = 'not tested'
  let probeBody: string = ''
  try {
    const url = `${process.env.NEON_AUTH_BASE_URL}/sign-up/email`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'diag@test.invalid', password: 'test1234', name: 'diag' }),
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
    probeUrl: `${baseUrl}/sign-up/email`,
    probeStatus,
    probeBody: probeBody.slice(0, 500),
  })
}

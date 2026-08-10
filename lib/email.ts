import { Resend } from 'resend'
import { sql } from '@/lib/db'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM_EMAIL ?? 'JoyPadel <noreply@joypadel.es>'

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
        <tr><td style="background:#2563eb;padding:24px 32px">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px">🎾 JoyPadel</span>
        </td></tr>
        <tr><td style="padding:32px">
          ${content}
        </td></tr>
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #f1f5f9">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Este email fue generado automáticamente — no respondas a este mensaje.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.4px">${text}</h1>`
}
function p(text: string) {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155">${text}</p>`
}
function pill(text: string, color = '#2563eb') {
  return `<span style="display:inline-block;background:${color}18;color:${color};font-size:13px;font-weight:600;padding:4px 12px;border-radius:99px;border:1px solid ${color}30">${text}</span>`
}

async function send(to: string | string[], subject: string, html: string) {
  if (!resend) { console.error('[email] RESEND_API_KEY not set — skipping'); return }
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html })
    if ('error' in result && result.error) console.error('[email] Resend error:', result.error)
  } catch (e) {
    console.error('[email] send failed:', e)
  }
}

// ── Email log ─────────────────────────────────────────────────────────────────

let tableReady = false

async function logEmail(opts: {
  tournamentId?: string | null
  type: string
  toEmail?: string | null
  toName?: string | null
  subject: string
  recipientCount?: number
}) {
  try {
    if (!tableReady) {
      await sql`
        CREATE TABLE IF NOT EXISTS email_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tournament_id UUID,
          type TEXT NOT NULL,
          to_email TEXT,
          to_name TEXT,
          subject TEXT NOT NULL,
          recipient_count INT NOT NULL DEFAULT 1,
          sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      tableReady = true
    }
    await sql`
      INSERT INTO email_logs (tournament_id, type, to_email, to_name, subject, recipient_count)
      VALUES (
        ${opts.tournamentId ?? null},
        ${opts.type},
        ${opts.toEmail ?? null},
        ${opts.toName ?? null},
        ${opts.subject},
        ${opts.recipientCount ?? 1}
      )
    `
  } catch (e) {
    console.error('[email] log failed:', e)
  }
}

// ── Send functions ─────────────────────────────────────────────────────────────

export async function sendRegistrationReceived(opts: {
  to: string
  playerName: string
  tournamentName: string
  tournamentId?: string | null
  customSubject?: string
  customBody?: string
}) {
  const subject = opts.customSubject?.trim()
    ? opts.customSubject
    : `Inscripción recibida — ${opts.tournamentName}`

  let bodyHtml: string
  if (opts.customBody?.trim()) {
    const rendered = opts.customBody
      .replace(/\{nombre\}/g, opts.playerName)
      .replace(/\{torneo\}/g, opts.tournamentName)
    bodyHtml = rendered
      .split('\n\n')
      .map(block => p(block.replace(/\n/g, '<br>')))
      .join('')
  } else {
    bodyHtml = `
      ${h1('¡Inscripción recibida!')}
      ${p(`Hola <strong>${opts.playerName}</strong>, tu solicitud de inscripción al torneo <strong>${opts.tournamentName}</strong> ha sido recibida correctamente.`)}
      <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin:0 0 20px">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Estado</p>
        ${pill('Pendiente de confirmación', '#f59e0b')}
      </div>
      ${p('El organizador revisará tu inscripción y recibirás otro email cuando sea confirmada.')}
    `
  }

  await send(opts.to, subject, layout(bodyHtml))
  await logEmail({ tournamentId: opts.tournamentId, type: 'registration_received', toEmail: opts.to, toName: opts.playerName, subject })
}

export async function sendRegistrationConfirmed(opts: {
  to: string
  playerName: string
  tournamentName: string
  tournamentId?: string | null
}) {
  const subject = `Plaza confirmada — ${opts.tournamentName}`
  const html = layout(`
    ${h1('¡Plaza confirmada! ✅')}
    ${p(`Hola <strong>${opts.playerName}</strong>, tu inscripción al torneo <strong>${opts.tournamentName}</strong> ha sido <strong>confirmada</strong>.`)}
    <div style="background:#f0fdf4;border-radius:8px;padding:16px 20px;margin:0 0 20px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Estado</p>
      ${pill('Confirmado', '#16a34a')}
    </div>
    ${p('Guarda este email como comprobante. Nos vemos en la pista. 🎾')}
  `)
  await send(opts.to, subject, html)
  await logEmail({ tournamentId: opts.tournamentId, type: 'registration_confirmed', toEmail: opts.to, toName: opts.playerName, subject })
}

export async function sendRegistrationAdded(opts: {
  to: string
  playerName: string
  tournamentName: string
  tournamentId?: string | null
}) {
  const subject = `Inscripción en ${opts.tournamentName}`
  const html = layout(`
    ${h1('Has sido inscrito en un torneo')}
    ${p(`Hola <strong>${opts.playerName}</strong>, el organizador te ha inscrito en el torneo <strong>${opts.tournamentName}</strong>.`)}
    <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin:0 0 20px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Estado</p>
      ${pill('Confirmado', '#16a34a')}
    </div>
    ${p('Si tienes alguna duda, contacta directamente con el organizador del torneo.')}
  `)
  await send(opts.to, subject, html)
  await logEmail({ tournamentId: opts.tournamentId, type: 'registration_added', toEmail: opts.to, toName: opts.playerName, subject })
}

export async function sendCustomEmail(opts: {
  recipients: Array<{ email: string; name?: string | null }>
  subject: string
  body: string
  tournamentName: string
  tournamentId?: string | null
}) {
  const hasVariables = opts.body.includes('{nombre}') || opts.body.includes('{torneo}') ||
    opts.subject.includes('{nombre}') || opts.subject.includes('{torneo}')

  function renderBody(name: string) {
    const rendered = opts.body
      .replace(/\{nombre\}/g, name)
      .replace(/\{torneo\}/g, opts.tournamentName)
    return rendered.split('\n\n').map(block => p(block.replace(/\n/g, '<br>'))).join('')
  }

  function renderSubject(name: string) {
    return opts.subject
      .replace(/\{nombre\}/g, name)
      .replace(/\{torneo\}/g, opts.tournamentName)
  }

  function buildHtml(bodyHtml: string) {
    return layout(`
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="margin:0;font-size:12px;color:#94a3b8">Enviado por el organizador de <strong>${opts.tournamentName}</strong></p>
    `)
  }

  if (hasVariables) {
    // Send individually so {nombre} is personalized per recipient
    for (const r of opts.recipients) {
      const name = r.name ?? 'jugador/a'
      await send(r.email, renderSubject(name), buildHtml(renderBody(name)))
    }
  } else {
    // Bulk send in batches of 50
    const emails = opts.recipients.map(r => r.email)
    const html = buildHtml(renderBody(''))
    for (let i = 0; i < emails.length; i += 50) {
      await send(emails.slice(i, i + 50), opts.subject, html)
    }
  }

  await logEmail({
    tournamentId: opts.tournamentId,
    type: 'broadcast',
    toEmail: null,
    toName: null,
    subject: opts.subject,
    recipientCount: opts.recipients.length,
  })
}

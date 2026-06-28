import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM_EMAIL ?? 'PadelManager <onboarding@resend.dev>'

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
        <tr><td style="background:#2563eb;padding:24px 32px">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px">🎾 PadelManager</span>
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

async function send(to: string, subject: string, html: string) {
  if (!resend) return
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
  } catch {
    // Email errors are non-fatal — registration still succeeds
  }
}

export async function sendRegistrationReceived(opts: {
  to: string
  playerName: string
  tournamentName: string
}) {
  const html = layout(`
    ${h1('¡Inscripción recibida!')}
    ${p(`Hola <strong>${opts.playerName}</strong>, tu solicitud de inscripción al torneo <strong>${opts.tournamentName}</strong> ha sido recibida correctamente.`)}
    <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin:0 0 20px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Estado</p>
      ${pill('Pendiente de confirmación', '#f59e0b')}
    </div>
    ${p('El organizador revisará tu inscripción y recibirás otro email cuando sea confirmada.')}
  `)
  await send(opts.to, `Inscripción recibida — ${opts.tournamentName}`, html)
}

export async function sendRegistrationConfirmed(opts: {
  to: string
  playerName: string
  tournamentName: string
}) {
  const html = layout(`
    ${h1('¡Plaza confirmada! ✅')}
    ${p(`Hola <strong>${opts.playerName}</strong>, tu inscripción al torneo <strong>${opts.tournamentName}</strong> ha sido <strong>confirmada</strong>.`)}
    <div style="background:#f0fdf4;border-radius:8px;padding:16px 20px;margin:0 0 20px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Estado</p>
      ${pill('Confirmado', '#16a34a')}
    </div>
    ${p('Guarda este email como comprobante. Nos vemos en la pista. 🎾')}
  `)
  await send(opts.to, `Plaza confirmada — ${opts.tournamentName}`, html)
}

export async function sendRegistrationAdded(opts: {
  to: string
  playerName: string
  tournamentName: string
}) {
  const html = layout(`
    ${h1('Has sido inscrito en un torneo')}
    ${p(`Hola <strong>${opts.playerName}</strong>, el organizador te ha inscrito en el torneo <strong>${opts.tournamentName}</strong>.`)}
    <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin:0 0 20px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Estado</p>
      ${pill('Confirmado', '#16a34a')}
    </div>
    ${p('Si tienes alguna duda, contacta directamente con el organizador del torneo.')}
  `)
  await send(opts.to, `Inscripción en ${opts.tournamentName}`, html)
}

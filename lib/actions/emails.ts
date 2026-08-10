'use server'

import { auth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { sendCustomEmail } from '@/lib/email'
import { z } from 'zod'

const sendEmailSchema = z.object({
  tournamentId: z.string().uuid(),
  subject: z.string().min(1, 'El asunto es obligatorio'),
  body: z.string().min(1, 'El cuerpo es obligatorio'),
  filter: z.enum(['all', 'confirmed', 'pending', 'waitlist']).default('all'),
  categoryFilter: z.string().optional(),
})

export async function sendEmailToPlayers(input: unknown): Promise<
  { data: { sent: number } } | { error: string }
> {
  const { data: session } = await auth.getSession()
  if (!session?.user?.id) return { error: 'No autenticado' }

  const parsed = sendEmailSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { tournamentId, subject, body, filter, categoryFilter } = parsed.data

  const t = await sql`SELECT name, organizer_id FROM tournaments WHERE id = ${tournamentId} LIMIT 1`
  if (!t[0]) return { error: 'Torneo no encontrado' }
  if (t[0].organizer_id !== session.user.id) return { error: 'Sin permiso' }

  const rows = await sql`
    SELECT
      form_data->>'email' AS email,
      COALESCE(player1_name, form_data->>'name') AS name,
      status,
      COALESCE(category, form_data->>'category') AS category
    FROM registrations
    WHERE tournament_id = ${tournamentId}
      AND form_data->>'email' IS NOT NULL
      AND form_data->>'email' != ''
      ${filter !== 'all' ? sql`AND status = ${filter}` : sql``}
      ${categoryFilter ? sql`AND COALESCE(category, form_data->>'category') = ${categoryFilter}` : sql``}
  `

  if (rows.length === 0) return { error: 'No hay destinatarios con email para los filtros seleccionados' }

  const recipients = rows.map(r => ({
    email: r.email as string,
    name: r.name as string | null,
  }))

  await sendCustomEmail({
    recipients,
    subject,
    body,
    tournamentName: t[0].name as string,
    tournamentId,
  })

  return { data: { sent: recipients.length } }
}

export type EmailLog = {
  id: string
  type: string
  toEmail: string | null
  toName: string | null
  subject: string
  recipientCount: number
  sentAt: string
}

export async function getEmailLogs(tournamentId: string): Promise<EmailLog[]> {
  try {
    const rows = await sql`
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
    void rows
  } catch { /* table already exists */ }

  const rows = await sql`
    SELECT id, type, to_email, to_name, subject, recipient_count, sent_at
    FROM email_logs
    WHERE tournament_id = ${tournamentId}
    ORDER BY sent_at DESC
    LIMIT 100
  `
  return rows.map(r => ({
    id: r.id as string,
    type: r.type as string,
    toEmail: r.to_email as string | null,
    toName: r.to_name as string | null,
    subject: r.subject as string,
    recipientCount: r.recipient_count as number,
    sentAt: (r.sent_at as Date).toISOString(),
  }))
}

export async function getEmailRecipientCount(
  tournamentId: string,
  filter: string,
  categoryFilter?: string
): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS n
    FROM registrations
    WHERE tournament_id = ${tournamentId}
      AND form_data->>'email' IS NOT NULL
      AND form_data->>'email' != ''
      ${filter !== 'all' ? sql`AND status = ${filter}` : sql``}
      ${categoryFilter ? sql`AND COALESCE(category, form_data->>'category') = ${categoryFilter}` : sql``}
  `
  return rows[0]?.n ?? 0
}

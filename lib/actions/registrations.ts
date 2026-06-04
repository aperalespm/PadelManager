'use server'

import { auth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { registerSchema } from '@/lib/validations'
import { z } from 'zod'

export async function getRegistrations(tournamentId: string) {
  // Ensure all columns added by later actions exist before querying
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS player1_name TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS player2_name TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'pair'`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'`

  const rows = await sql`
    SELECT r.*,
      COALESCE(p1.display_name, r.player1_name) AS player1_name, p1.category AS player1_category,
      p2.display_name AS player2_display_name, p2.category AS player2_category
    FROM registrations r
    LEFT JOIN user_profiles p1 ON p1.user_id = r.player1_id
    LEFT JOIN user_profiles p2 ON p2.user_id = r.player2_id
    WHERE r.tournament_id = ${tournamentId}
    ORDER BY r.created_at ASC
  `
  return { data: rows }
}

const addParticipantSchema = z.object({
  tournament_id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  partner_name: z.string().optional(),
  partner_email: z.string().email().optional(),
  registration_type: z.enum(['pair', 'individual']).optional(),
  status: z.enum(['confirmed', 'pending']).optional(),
})

export async function addParticipantByAdmin(input: unknown) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }

  const parsed = addParticipantSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { tournament_id, name, email, partner_name, partner_email, registration_type, status } = parsed.data

  const t = await sql`SELECT organizer_id, max_players, status FROM tournaments WHERE id = ${tournament_id} LIMIT 1`
  if (!t[0]) return { error: 'Torneo no encontrado' }
  if (t[0].organizer_id !== session.user.id) return { error: 'No autorizado' }

  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS player1_name TEXT`

  const desiredStatus = status ?? 'confirmed'
  let finalStatus: string = desiredStatus
  let waitlistPosition: number | null = null

  if (desiredStatus === 'confirmed') {
    const confirmed = await sql`SELECT count(*)::int AS n FROM registrations WHERE tournament_id = ${tournament_id} AND status = 'confirmed'`
    const isFull = confirmed[0].n >= t[0].max_players
    if (isFull) {
      finalStatus = 'waitlist'
      const wl = await sql`SELECT count(*)::int AS n FROM registrations WHERE tournament_id = ${tournament_id} AND status = 'waitlist'`
      waitlistPosition = (wl[0].n ?? 0) + 1
    }
  }

  const rows = await sql`
    INSERT INTO registrations (tournament_id, player1_id, player1_name, player2_name, registration_type, form_data, status, waitlist_position)
    VALUES (${tournament_id}, null, ${name}, ${partner_name ?? null}, ${registration_type ?? 'pair'}, ${JSON.stringify({ name, email, partner_name, partner_email })}, ${finalStatus}, ${waitlistPosition})
    RETURNING *
  `
  return { data: rows[0] }
}

export async function registerForTournament(input: unknown) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }

  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { tournament_id, player2_id, player2_name, registration_type, form_data } = parsed.data

  const t = await sql`SELECT max_players, registration_type, status FROM tournaments WHERE id = ${tournament_id} LIMIT 1`
  if (!t[0]) return { error: 'Torneo no encontrado' }
  if (t[0].status !== 'open') return { error: 'Las inscripciones están cerradas' }

  const confirmed = await sql`SELECT count(*)::int AS n FROM registrations WHERE tournament_id = ${tournament_id} AND status = 'confirmed'`
  const isFull = confirmed[0].n >= t[0].max_players

  const existing = await sql`SELECT id FROM registrations WHERE tournament_id = ${tournament_id} AND (player1_id = ${session.user.id} OR player2_id = ${session.user.id}) LIMIT 1`
  if (existing[0]) return { error: 'Ya estás inscrito en este torneo' }

  const status = isFull ? 'waitlist' : 'pending'
  let waitlistPosition = null
  if (isFull) {
    const wl = await sql`SELECT count(*)::int AS n FROM registrations WHERE tournament_id = ${tournament_id} AND status = 'waitlist'`
    waitlistPosition = (wl[0].n ?? 0) + 1
  }

  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'pair'`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'`

  const rows = await sql`
    INSERT INTO registrations (tournament_id, player1_id, player2_id, player2_name, registration_type, form_data, status, waitlist_position)
    VALUES (${tournament_id}, ${session.user.id}, ${player2_id ?? null}, ${player2_name ?? null}, ${registration_type ?? 'pair'}, ${JSON.stringify(form_data ?? {})}, ${status}, ${waitlistPosition})
    RETURNING *
  `
  return { data: rows[0] }
}

export async function confirmRegistration(registrationId: string) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }
  const r = await sql`SELECT r.*, t.organizer_id FROM registrations r JOIN tournaments t ON t.id = r.tournament_id WHERE r.id = ${registrationId} LIMIT 1`
  if (!r[0] || r[0].organizer_id !== session.user.id) return { error: 'No autorizado' }
  const rows = await sql`UPDATE registrations SET status = 'confirmed', updated_at = NOW() WHERE id = ${registrationId} RETURNING *`
  return { data: rows[0] }
}

export async function promoteFromWaitlist(registrationId: string) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }
  const r = await sql`SELECT r.*, t.organizer_id FROM registrations r JOIN tournaments t ON t.id = r.tournament_id WHERE r.id = ${registrationId} LIMIT 1`
  if (!r[0] || r[0].organizer_id !== session.user.id) return { error: 'No autorizado' }
  const rows = await sql`UPDATE registrations SET status = 'confirmed', waitlist_position = NULL, updated_at = NOW() WHERE id = ${registrationId} RETURNING *`
  return { data: rows[0] }
}

export async function getMyRegistrations() {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { data: [] }
  const rows = await sql`
    SELECT r.*, t.name AS tournament_name, t.start_date, t.status AS tournament_status, t.share_slug
    FROM registrations r
    JOIN tournaments t ON t.id = r.tournament_id
    WHERE r.player1_id = ${session.user.id} OR r.player2_id = ${session.user.id}
    ORDER BY t.start_date DESC
  `
  return { data: rows }
}

export async function getMyActiveMatch() {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { data: null }

  const rows = await sql`
    SELECT m.*,
      t.name AS tournament_name, t.id AS tournament_id,
      ph.name AS phase_name,
      r1.player1_id AS team1_p1, r1.player2_id AS team1_p2, r1.player2_name AS team1_p2_name,
      r2.player1_id AS team2_p1, r2.player2_id AS team2_p2, r2.player2_name AS team2_p2_name,
      p1a.display_name AS team1_p1_name,
      p2a.display_name AS team2_p1_name
    FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    JOIN tournament_phases ph ON ph.id = m.phase_id
    LEFT JOIN registrations r1 ON r1.id = m.team1_reg_id
    LEFT JOIN registrations r2 ON r2.id = m.team2_reg_id
    LEFT JOIN user_profiles p1a ON p1a.user_id = r1.player1_id
    LEFT JOIN user_profiles p2a ON p2a.user_id = r2.player1_id
    WHERE t.status = 'active'
      AND m.status NOT IN ('finished')
      AND (r1.player1_id = ${session.user.id} OR r1.player2_id = ${session.user.id} OR r2.player1_id = ${session.user.id} OR r2.player2_id = ${session.user.id})
    ORDER BY m.scheduled_at ASC
    LIMIT 1
  `
  return { data: rows[0] ?? null }
}

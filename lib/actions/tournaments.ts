'use server'

import { auth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { createTournamentSchema, updateTournamentSchema } from '@/lib/validations'

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 7)
}

export async function getTournaments(filters?: { category?: string; status?: string; search?: string }) {
  const rows = await sql`
    SELECT t.*,
      (SELECT count(*) FROM registrations r WHERE r.tournament_id = t.id AND r.status = 'confirmed')::int AS confirmed_count
    FROM tournaments t
    WHERE t.status IN ('open', 'active', 'finished')
    ${filters?.category ? sql`AND t.category = ${filters.category}` : sql``}
    ${filters?.status ? sql`AND t.status = ${filters.status}` : sql``}
    ${filters?.search ? sql`AND t.name ILIKE ${'%' + filters.search + '%'}` : sql``}
    ORDER BY t.start_date ASC
  `
  return rows
}

export async function getTournamentBySlug(slug: string) {
  const rows = await sql`
    SELECT t.*,
      (SELECT count(*) FROM registrations r WHERE r.tournament_id = t.id AND r.status = 'confirmed')::int AS confirmed_count
    FROM tournaments t
    WHERE t.share_slug = ${slug}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function getTournamentById(id: string) {
  const rows = await sql`
    SELECT t.*,
      (SELECT count(*) FROM registrations r WHERE r.tournament_id = t.id AND r.status = 'confirmed')::int AS confirmed_count
    FROM tournaments t
    WHERE t.id = ${id}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function getMyTournaments() {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { data: [] }
  const rows = await sql`
    SELECT t.*,
      (SELECT count(*) FROM registrations r WHERE r.tournament_id = t.id)::int AS total_registrations,
      (SELECT count(*) FROM registrations r WHERE r.tournament_id = t.id AND r.status = 'confirmed')::int AS confirmed_count
    FROM tournaments t
    WHERE t.organizer_id = ${session.user.id}
    ORDER BY t.created_at DESC
  `
  return { data: rows }
}

export async function createTournament(input: unknown) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }

  const parsed = createTournamentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data
  const slug = generateSlug(d.name)

  const rows = await sql`
    INSERT INTO tournaments (organizer_id, name, description, venue_name, venue_address, venue_details, category, format, registration_type, max_players, price_info, cancel_deadline, start_date, end_date, share_slug, status)
    VALUES (${session.user.id}, ${d.name}, ${d.description ?? null}, ${d.venue_name}, ${d.venue_address}, ${JSON.stringify(d.venue_details ?? {})}, ${d.category}, ${d.format}, ${d.registration_type}, ${d.max_players}, ${d.price_info ?? null}, ${d.cancel_deadline ?? null}, ${d.start_date}, ${d.end_date ?? null}, ${slug}, 'draft')
    RETURNING *
  `
  return { data: rows[0] }
}

export async function updateTournament(id: string, input: unknown) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }

  const existing = await sql`SELECT organizer_id FROM tournaments WHERE id = ${id} LIMIT 1`
  if (!existing[0] || existing[0].organizer_id !== session.user.id) return { error: 'No autorizado' }

  const parsed = updateTournamentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data
  const rows = await sql`
    UPDATE tournaments SET
      name = COALESCE(${d.name ?? null}, name),
      description = COALESCE(${d.description ?? null}, description),
      venue_name = COALESCE(${d.venue_name ?? null}, venue_name),
      venue_address = COALESCE(${d.venue_address ?? null}, venue_address),
      category = COALESCE(${d.category ?? null}, category),
      format = COALESCE(${d.format ?? null}, format),
      registration_type = COALESCE(${d.registration_type ?? null}, registration_type),
      max_players = COALESCE(${d.max_players ?? null}, max_players),
      price_info = COALESCE(${d.price_info ?? null}, price_info),
      start_date = COALESCE(${d.start_date ?? null}, start_date),
      end_date = COALESCE(${d.end_date ?? null}, end_date),
      updated_at = NOW()
    WHERE id = ${id} AND organizer_id = ${session.user.id}
    RETURNING *
  `
  return { data: rows[0] }
}

export async function publishTournament(id: string) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }
  const rows = await sql`
    UPDATE tournaments SET status = 'open', updated_at = NOW()
    WHERE id = ${id} AND organizer_id = ${session.user.id} AND status = 'draft'
    RETURNING *
  `
  if (!rows[0]) return { error: 'No se pudo publicar' }
  return { data: rows[0] }
}

export async function closeTournamentRegistrations(id: string) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }
  const rows = await sql`
    UPDATE tournaments SET status = 'active', updated_at = NOW()
    WHERE id = ${id} AND organizer_id = ${session.user.id} AND status = 'open'
    RETURNING *
  `
  if (!rows[0]) return { error: 'No se pudo cerrar' }
  return { data: rows[0] }
}

export async function saveTournamentPhases(tournamentId: string, phases: Array<{ name: string; format: string; score_config: Record<string, unknown> }>) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }
  const t = await sql`SELECT organizer_id FROM tournaments WHERE id = ${tournamentId} LIMIT 1`
  if (!t[0] || t[0].organizer_id !== session.user.id) return { error: 'No autorizado' }

  await sql`DELETE FROM tournament_phases WHERE tournament_id = ${tournamentId}`
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i]
    await sql`
      INSERT INTO tournament_phases (tournament_id, phase_order, name, format, score_config)
      VALUES (${tournamentId}, ${i + 1}, ${p.name}, ${p.format}, ${JSON.stringify(p.score_config)})
    `
  }
  return { data: true }
}

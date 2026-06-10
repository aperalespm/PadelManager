'use server'

import { sql } from '@/lib/db'
import { z } from 'zod'
import { createTournamentSchema, updateTournamentSchema } from '@/lib/validations'
import { generateSchedule, type GeneratorConfig, type PhaseDurations } from '@/lib/schedule/generator'

const DEMO_ORGANIZER_ID = '00000000-0000-0000-0000-000000000000'

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
  const rows = await sql`
    SELECT t.*,
      (SELECT count(*) FROM registrations r WHERE r.tournament_id = t.id)::int AS total_registrations,
      (SELECT count(*) FROM registrations r WHERE r.tournament_id = t.id AND r.status = 'confirmed')::int AS confirmed_count
    FROM tournaments t
    ORDER BY t.created_at DESC
  `
  return { data: rows }
}

export async function getAllTournamentsForSidebar() {
  const rows = await sql`
    SELECT id, name, status FROM tournaments ORDER BY created_at ASC
  `
  return rows as { id: string; name: string; status: string }[]
}

export async function createDraftTournament() {
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const slug = generateSlug('nuevo-torneo')
  const rows = await sql`
    INSERT INTO tournaments (organizer_id, name, venue_name, venue_address, venue_details, category, format, registration_type, max_players, start_date, share_slug, status)
    VALUES (${DEMO_ORGANIZER_ID}, 'Nuevo torneo', 'Por confirmar', 'Por confirmar', '{}', 'Abierta', 'elimination', 'pair', 16, ${nextWeek.toISOString()}, ${slug}, 'draft')
    RETURNING id
  `
  return { data: rows[0] as { id: string } }
}

export async function createTournament(input: unknown) {
  const parsed = createTournamentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data
  const slug = generateSlug(d.name)

  const rows = await sql`
    INSERT INTO tournaments (organizer_id, name, description, venue_name, venue_address, venue_details, category, format, registration_type, max_players, price_info, cancel_deadline, start_date, end_date, share_slug, status)
    VALUES (${DEMO_ORGANIZER_ID}, ${d.name}, ${d.description ?? null}, ${d.venue_name}, ${d.venue_address}, ${JSON.stringify(d.venue_details ?? {})}, ${d.category}, ${d.format}, ${d.registration_type}, ${d.max_players}, ${d.price_info ?? null}, ${d.cancel_deadline ?? null}, ${d.start_date}, ${d.end_date ?? null}, ${slug}, 'draft')
    RETURNING *
  `
  return { data: rows[0] }
}

export async function updateTournament(id: string, input: unknown) {
  const parsed = updateTournamentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data

  if (d.name) {
    const dup = await sql`SELECT id FROM tournaments WHERE name = ${d.name} AND id != ${id} LIMIT 1`
    if (dup[0]) return { error: 'Ya existe un torneo con ese nombre' }
  }

  const rows = await sql`
    UPDATE tournaments SET
      name = COALESCE(${d.name ?? null}, name),
      description = COALESCE(${d.description ?? null}, description),
      venue_name = COALESCE(${d.venue_name ?? null}, venue_name),
      venue_address = COALESCE(${d.venue_address ?? null}, venue_address),
      venue_details = COALESCE(${d.venue_details ? JSON.stringify(d.venue_details) : null}::jsonb, venue_details),
      category = COALESCE(${d.category ?? null}, category),
      format = COALESCE(${d.format ?? null}, format),
      registration_type = COALESCE(${d.registration_type ?? null}, registration_type),
      max_players = COALESCE(${d.max_players ?? null}, max_players),
      price_info = COALESCE(${d.price_info ?? null}, price_info),
      start_date = COALESCE(${d.start_date ?? null}, start_date),
      end_date = COALESCE(${d.end_date ?? null}, end_date),
      cancel_deadline = COALESCE(${d.cancel_deadline ?? null}, cancel_deadline),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return { data: rows[0] }
}

export async function publishTournament(id: string) {
  const rows = await sql`
    UPDATE tournaments SET status = 'open', updated_at = NOW()
    WHERE id = ${id} AND status = 'draft'
    RETURNING *
  `
  if (!rows[0]) return { error: 'No se pudo publicar' }
  return { data: rows[0] }
}

export async function closeTournamentRegistrations(id: string) {
  const rows = await sql`
    UPDATE tournaments SET status = 'active', updated_at = NOW()
    WHERE id = ${id} AND status = 'open'
    RETURNING *
  `
  if (!rows[0]) return { error: 'No se pudo cerrar' }
  return { data: rows[0] }
}

export async function deleteTournament(id: string) {
  await sql`DELETE FROM tournament_phases WHERE tournament_id = ${id}`
  await sql`DELETE FROM registrations WHERE tournament_id = ${id}`
  await sql`DELETE FROM tournaments WHERE id = ${id}`
  return { data: true }
}

export async function duplicateTournament(id: string) {
  const src = await sql`SELECT * FROM tournaments WHERE id = ${id} LIMIT 1`
  if (!src[0]) return { error: 'Torneo no encontrado' }
  const s = src[0] as Record<string, unknown>
  const slug = generateSlug('copia')
  const rows = await sql`
    INSERT INTO tournaments (organizer_id, name, description, venue_name, venue_address, venue_details, category, format, registration_type, max_players, price_info, start_date, end_date, cancel_deadline, share_slug, status)
    VALUES (${DEMO_ORGANIZER_ID}, ${'Copia de ' + (s.name as string)}, ${s.description ?? null}, ${s.venue_name}, ${s.venue_address}, ${s.venue_details ? JSON.stringify(s.venue_details) : '{}'}::jsonb, ${s.category}, ${s.format}, ${s.registration_type}, ${s.max_players}, ${s.price_info ?? null}, ${s.start_date}, ${s.end_date ?? null}, ${s.cancel_deadline ?? null}, ${slug}, 'draft')
    RETURNING id
  `
  const newId = (rows[0] as { id: string }).id
  const phases = await sql`SELECT * FROM tournament_phases WHERE tournament_id = ${id} ORDER BY phase_order ASC`
  for (const p of phases as Record<string, unknown>[]) {
    await sql`
      INSERT INTO tournament_phases (tournament_id, phase_order, name, format, score_config)
      VALUES (${newId}, ${p.phase_order}, ${p.name}, ${p.format}, ${p.score_config ? JSON.stringify(p.score_config) : '{}'}::jsonb)
    `
  }
  return { data: { id: newId } }
}

export async function saveTournamentPhases(tournamentId: string, phases: Array<{ name: string; format: string; score_config: Record<string, unknown> }>) {
  // Read existing phases to preserve their IDs — matches.phase_id references them and
  // a full DELETE would cascade-delete all matches via the FK constraint.
  const existing = await sql`
    SELECT id, phase_order FROM tournament_phases
    WHERE tournament_id = ${tournamentId}
    ORDER BY phase_order ASC
  `

  for (let i = 0; i < phases.length; i++) {
    const p = phases[i]
    const match = (existing as Array<{ id: string; phase_order: number }>).find(e => e.phase_order === i + 1)
    if (match) {
      await sql`
        UPDATE tournament_phases
        SET name = ${p.name}, format = ${p.format}, score_config = ${JSON.stringify(p.score_config)}::jsonb
        WHERE id = ${match.id}
      `
    } else {
      await sql`
        INSERT INTO tournament_phases (tournament_id, phase_order, name, format, score_config)
        VALUES (${tournamentId}, ${i + 1}, ${p.name}, ${p.format}, ${JSON.stringify(p.score_config)}::jsonb)
      `
    }
  }

  // Remove any extra phases beyond the new count (preserves fewer phases case)
  const toDelete = (existing as Array<{ id: string; phase_order: number }>)
    .filter(e => e.phase_order > phases.length)
  for (const phase of toDelete) {
    await sql`DELETE FROM tournament_phases WHERE id = ${phase.id}`
  }

  return { data: true }
}

// ── Tournament creation wizard ────────────────────────────────────────────────

const wizardSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  startDate: z.string().min(1, 'La fecha de inicio es obligatoria'),
  endDate: z.string().optional(),
  courts: z.array(z.object({ name: z.string().min(1) })).min(1, 'Al menos una pista'),
  startTime: z.string(),
  endTime: z.string(),
  transitionMins: z.number().int().min(0).max(120),
  hasLunch: z.boolean(),
  lunchTime: z.string().optional(),
  lunchDuration: z.number().int().min(0).max(480).optional(),
  categories: z.array(z.object({
    name: z.string().min(1),
    genders: z.array(z.string()),
  })).min(1, 'Al menos una categoría'),
  phaseDurations: z.object({
    groups: z.number().int().min(10).max(300),
    roundOf16: z.number().int().min(10).max(300),
    quarterFinal: z.number().int().min(10).max(300),
    semiFinal: z.number().int().min(10).max(300),
    final: z.number().int().min(10).max(300),
  }),
  minGroups: z.number().int().min(1).max(20),
  minTeamsPerGroup: z.number().int().min(2).max(10),
  teamsAdvancePerGroup: z.number().int().min(1).max(10),
  minMatchesPerTeam: z.number().int().min(1).max(10),
})

export async function createTournamentFromWizard(input: unknown): Promise<
  { data: { tournamentId: string } } | { error: string }
> {
  const parsed = wizardSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const d = parsed.data
  const slug = generateSlug(d.name)

  const lunchBreak = d.hasLunch && d.lunchTime && d.lunchDuration
    ? { time: d.lunchTime, duration_minutes: d.lunchDuration }
    : null

  const expandedCategories = d.categories.flatMap(c =>
    c.genders.length === 0
      ? [{ id: c.name, name: c.name }]
      : c.genders.map(g => ({
          id: `${c.name}_${g}`,
          name: `${c.name} ${g === 'M' ? 'Masculino' : g === 'F' ? 'Femenino' : g}`,
        }))
  )

  const pd: PhaseDurations = d.phaseDurations
  const generatorConfig: GeneratorConfig = {
    courts: d.courts.map((c, i) => ({ name: c.name, courtNumber: i + 1, breaks: [] })),
    schedule: {
      startTime: d.startTime,
      endTime: d.endTime,
      transitionMins: d.transitionMins,
      lunchBreak,
    },
    categories: expandedCategories,
    phases: [{ name: 'Grupos', maxDurationMins: pd.groups }],
    phaseDurations: pd,
    format: {
      minGroups: d.minGroups,
      minTeamsPerGroup: d.minTeamsPerGroup,
      teamsAdvancePerGroup: d.teamsAdvancePerGroup,
      minMatchesPerTeam: d.minMatchesPerTeam,
    },
  }

  const { schedule: generatedSchedule } = generateSchedule(generatorConfig)

  const venueDetails = {
    courts: d.courts,
    schedule: {
      start_time: d.startTime,
      end_time: d.endTime,
      transition_minutes: d.transitionMins,
      lunch_break: lunchBreak,
      time_blocks: [],
    },
    categories: d.categories,
    phase_durations: pd,
    phases: [
      { name: 'Grupos',           match_config: { time_limit_minutes: pd.groups } },
      { name: 'Octavos de final', match_config: { time_limit_minutes: pd.roundOf16 } },
      { name: 'Cuartos de final', match_config: { time_limit_minutes: pd.quarterFinal } },
      { name: 'Semifinal',        match_config: { time_limit_minutes: pd.semiFinal } },
      { name: 'Final',            match_config: { time_limit_minutes: pd.final } },
    ],
    num_groups: d.minGroups,
    teams_per_group: d.minTeamsPerGroup,
    teams_advance_per_group: d.teamsAdvancePerGroup,
    min_matches_per_team: d.minMatchesPerTeam,
  }

  const categoryLabel = d.categories.length === 1 ? d.categories[0].name : 'Múltiple'

  try {
    const tRows = await sql`
      INSERT INTO tournaments
        (organizer_id, name, venue_name, venue_address, venue_details, category, format, registration_type, max_players, start_date, end_date, share_slug, status)
      VALUES (
        ${DEMO_ORGANIZER_ID}, ${d.name}, 'Por confirmar', 'Por confirmar',
        ${JSON.stringify(venueDetails)}::jsonb,
        ${categoryLabel}, 'groups_elimination', 'pair',
        ${d.minGroups * d.minTeamsPerGroup * expandedCategories.length * 2},
        ${d.startDate}, ${d.endDate ?? null}, ${slug}, 'draft'
      )
      RETURNING id
    `
    const tournamentId = (tRows[0] as { id: string }).id

    await sql`
      CREATE TABLE IF NOT EXISTS tournament_schedules (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         TEXT NOT NULL,
        tournament_id   UUID NOT NULL UNIQUE,
        schedule_data   JSONB NOT NULL,
        version         INTEGER DEFAULT 1,
        is_published    BOOLEAN DEFAULT false,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`ALTER TABLE tournament_schedules ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '[]'`

    const historyEntry = {
      version: 1,
      savedAt: new Date().toISOString(),
      label: 'Generado automáticamente',
      schedule: generatedSchedule,
    }
    await sql`
      INSERT INTO tournament_schedules (user_id, tournament_id, schedule_data, version_history, version)
      VALUES (${DEMO_ORGANIZER_ID}, ${tournamentId}, ${JSON.stringify(generatedSchedule)}, ${JSON.stringify([historyEntry])}, 1)
    `

    return { data: { tournamentId } }
  } catch (e) {
    console.error('[createTournamentFromWizard]', e)
    return { error: `Error creando el torneo: ${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function updateRegistrationConfig(id: string, config: unknown) {
  await sql`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_config JSONB DEFAULT '{}'`
  const rows = await sql`
    UPDATE tournaments
    SET registration_config = ${JSON.stringify(config)}::jsonb, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `
  if (!rows[0]) return { error: 'Torneo no encontrado' }
  return { data: true }
}

'use server'

import { auth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { registerSchema } from '@/lib/validations'
import { z } from 'zod'
import { sendRegistrationReceived, sendRegistrationConfirmed, sendRegistrationAdded } from '@/lib/email'

export async function getRegistrationCountsByCategory(tournamentId: string): Promise<
  Array<{ category: string; confirmed: number; pending: number; waitlist: number }>
> {
  const rows = await sql`
    SELECT
      COALESCE(category, form_data->>'category', '') AS category,
      COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
      COUNT(*) FILTER (WHERE status = 'pending')::int   AS pending,
      COUNT(*) FILTER (WHERE status = 'waitlist')::int  AS waitlist
    FROM registrations
    WHERE tournament_id = ${tournamentId}
    GROUP BY COALESCE(category, form_data->>'category', '')
    ORDER BY COALESCE(category, form_data->>'category', '') ASC
  `
  return rows as Array<{ category: string; confirmed: number; pending: number; waitlist: number }>
}

export async function getRegistrations(tournamentId: string) {
  // Ensure all columns added by later actions exist before querying
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS player1_name TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS player2_name TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'pair'`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS category TEXT`
  // Back-fill category column from form_data for existing rows
  await sql`UPDATE registrations SET category = form_data->>'category' WHERE category IS NULL AND form_data->>'category' IS NOT NULL AND form_data->>'category' != ''`

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
  partner_name: z.string().optional(),
  registration_type: z.enum(['pair', 'individual']).optional(),
  status: z.enum(['confirmed', 'pending']).optional(),
  category: z.string().optional(),
  form_data: z.record(z.string(), z.string()).optional(),
})

export async function addParticipantByAdmin(input: unknown) {
  const parsed = addParticipantSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { tournament_id, name, partner_name, registration_type, status, category, form_data } = parsed.data

  const t = await sql`SELECT max_players, name FROM tournaments WHERE id = ${tournament_id} LIMIT 1`
  if (!t[0]) return { error: 'Torneo no encontrado' }

  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS player1_name TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'pair'`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS category TEXT`

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

  // Merge explicit fields into form_data so all data is queryable from JSONB
  const mergedFormData = { ...form_data, name, partner_name: partner_name ?? undefined, category: category ?? undefined }
  const resolvedCategory = category ?? (form_data?.category ?? null)

  const rows = await sql`
    INSERT INTO registrations (tournament_id, player1_name, player2_name, registration_type, form_data, category, status, waitlist_position)
    VALUES (${tournament_id}, ${name}, ${partner_name ?? null}, ${registration_type ?? 'pair'}, ${JSON.stringify(mergedFormData)}, ${resolvedCategory}, ${finalStatus}, ${waitlistPosition})
    RETURNING *
  `

  const emailAddr = (mergedFormData as Record<string, unknown>).email as string | undefined
  if (emailAddr && name) {
    await sendRegistrationAdded({ to: emailAddr, playerName: name, tournamentName: t[0].name as string })
  }

  return { data: rows[0] }
}

export async function registerForTournament(input: unknown) {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { tournament_id, player2_name, registration_type, form_data } = parsed.data

  const t = await sql`SELECT max_players, status, registration_config FROM tournaments WHERE id = ${tournament_id} LIMIT 1`
  if (!t[0]) return { error: 'Torneo no encontrado' }
  if (t[0].status !== 'open') return { error: 'Las inscripciones están cerradas' }

  // Server-side validation against registration_config
  const regConfig = t[0].registration_config as { system_fields?: Record<string, boolean>; custom_fields?: Array<{ id: string; required: boolean; type: string; label: string }> } | null
  if (regConfig) {
    const fd = (form_data as Record<string, string>) ?? {}
    const sf = regConfig.system_fields ?? {}
    const isPair = registration_type === 'pair'
    if (sf.name     && !fd.name?.trim())         return { error: 'El nombre es obligatorio' }
    if (sf.email    && !fd.email?.trim())        return { error: 'El email es obligatorio' }
    if (sf.phone    && !fd.phone?.trim())        return { error: 'El teléfono es obligatorio' }
    if (sf.level    && !fd.level?.trim())        return { error: 'El nivel es obligatorio' }
    if (!fd.side?.trim())                        return { error: 'Indica el lado en pista del jugador 1' }
    if (isPair) {
      if (sf.partner_name  && !fd.partner_name?.trim())  return { error: 'El nombre de tu pareja es obligatorio' }
      if (sf.partner_email && !fd.partner_email?.trim()) return { error: 'El email de tu pareja es obligatorio' }
      if (sf.partner_phone && !fd.partner_phone?.trim()) return { error: 'El teléfono de tu pareja es obligatorio' }
      if (!fd.partner_side?.trim())                       return { error: 'Indica el lado en pista del jugador 2' }
    }
    for (const cf of regConfig.custom_fields ?? []) {
      if (!cf.required) continue
      if (cf.type === 'checkbox' && fd[cf.id] !== 'true') return { error: `"${cf.label}" es obligatorio` }
      if (cf.type !== 'checkbox' && !fd[cf.id]?.trim())   return { error: `"${cf.label}" es obligatorio` }
    }
  }

  // Duplicate check by email stored in form_data
  const email = (form_data as Record<string, unknown>)?.email as string | undefined
  if (email) {
    const existing = await sql`
      SELECT id FROM registrations
      WHERE tournament_id = ${tournament_id} AND form_data->>'email' = ${email}
      LIMIT 1
    `
    if (existing[0]) return { error: 'Ya estás inscrito en este torneo' }
  }

  const confirmed = await sql`SELECT count(*)::int AS n FROM registrations WHERE tournament_id = ${tournament_id} AND status = 'confirmed'`
  const isFull = confirmed[0].n >= t[0].max_players

  const status = isFull ? 'waitlist' : 'pending'
  let waitlistPosition = null
  if (isFull) {
    const wl = await sql`SELECT count(*)::int AS n FROM registrations WHERE tournament_id = ${tournament_id} AND status = 'waitlist'`
    waitlistPosition = (wl[0].n ?? 0) + 1
  }

  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS player1_name TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'pair'`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS category TEXT`

  const category = (form_data as Record<string, unknown>)?.category as string | null ?? null
  const player1Name = (form_data as Record<string, unknown>)?.name as string | null ?? null

  const rows = await sql`
    INSERT INTO registrations (tournament_id, player1_name, player2_name, registration_type, form_data, category, status, waitlist_position)
    VALUES (${tournament_id}, ${player1Name}, ${player2_name ?? null}, ${registration_type ?? 'pair'}, ${JSON.stringify(form_data ?? {})}, ${category}, ${status}, ${waitlistPosition})
    RETURNING *
  `

  if (email && player1Name) {
    await sendRegistrationReceived({ to: email, playerName: player1Name, tournamentName: t[0].name as string })
  }

  return { data: rows[0] }
}

export async function confirmRegistration(registrationId: string) {
  const rows = await sql`
    UPDATE registrations SET status = 'confirmed', updated_at = NOW()
    WHERE id = ${registrationId}
    RETURNING *, (SELECT name FROM tournaments WHERE id = registrations.tournament_id) AS tournament_name
  `
  if (!rows[0]) return { error: 'Inscripción no encontrada' }
  const r = rows[0]
  const fd = (r.form_data as Record<string, unknown>) ?? {}
  const email = fd.email as string | undefined
  const name = (r.player1_name as string) || (fd.name as string) || ''
  if (email && name) {
    await sendRegistrationConfirmed({ to: email, playerName: name, tournamentName: r.tournament_name as string })
  }
  return { data: r }
}

export async function promoteFromWaitlist(registrationId: string) {
  const rows = await sql`UPDATE registrations SET status = 'confirmed', waitlist_position = NULL, updated_at = NOW() WHERE id = ${registrationId} RETURNING *`
  if (!rows[0]) return { error: 'Inscripción no encontrada' }
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

export async function getConfirmedPairsForSchedule(tournamentId: string): Promise<
  Array<{ category: string; pairs: string[] }>
> {
  const rows = await sql`
    SELECT
      COALESCE(up1.display_name, r.player1_name, '?') AS p1_name,
      COALESCE(up2.display_name, r.player2_name)       AS p2_name,
      COALESCE(r.category, (r.form_data->>'category')::text, '') AS category
    FROM registrations r
    LEFT JOIN user_profiles up1 ON up1.user_id = r.player1_id
    LEFT JOIN user_profiles up2 ON up2.user_id = r.player2_id
    WHERE r.tournament_id = ${tournamentId} AND r.status = 'confirmed'
    ORDER BY r.created_at ASC
  `

  const byCat: Record<string, string[]> = {}
  for (const r of rows) {
    const cat = (r.category as string) || ''
    if (!byCat[cat]) byCat[cat] = []
    const name = r.p2_name
      ? `${r.p1_name} / ${r.p2_name}`
      : (r.p1_name as string)
    byCat[cat].push(name)
  }

  return Object.entries(byCat).map(([category, pairs]) => ({ category, pairs }))
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

export async function deleteRegistration(registrationId: string) {
  try {
    // Nullify references in matches before deleting
    await sql`UPDATE matches SET team1_reg_id = NULL WHERE team1_reg_id = ${registrationId}`
    await sql`UPDATE matches SET team2_reg_id = NULL WHERE team2_reg_id = ${registrationId}`
    await sql`DELETE FROM registrations WHERE id = ${registrationId}`
    return { data: true }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function removePlayerFromPair(registrationId: string, playerIndex: 1 | 2) {
  try {
    if (playerIndex === 2) {
      await sql`
        UPDATE registrations
        SET player2_name = NULL, player2_id = NULL, registration_type = 'individual', updated_at = NOW()
        WHERE id = ${registrationId}
      `
    } else {
      // Move player2 into player1 slot, clear player2
      const rows = await sql`SELECT player2_name, player2_id FROM registrations WHERE id = ${registrationId} LIMIT 1`
      if (!rows[0]) return { error: 'Registro no encontrado' }
      const p2Name = rows[0].player2_name as string | null
      const p2Id = rows[0].player2_id as string | null
      await sql`
        UPDATE registrations
        SET player1_name = ${p2Name}, player1_id = ${p2Id},
            player2_name = NULL, player2_id = NULL,
            registration_type = 'individual', updated_at = NOW()
        WHERE id = ${registrationId}
      `
    }
    return { data: true }
  } catch (e) {
    return { error: String(e) }
  }
}

const updateRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  player1_name: z.string().min(1),
  player2_name: z.string().nullable(),
  status: z.enum(['confirmed', 'pending', 'waitlist']),
  form_data: z.record(z.string(), z.unknown()),
})

export async function updateRegistration(input: unknown) {
  const parsed = updateRegistrationSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { registrationId, player1_name, player2_name, status, form_data } = parsed.data
  const registration_type = player2_name ? 'pair' : 'individual'
  const category = (form_data.category as string) || null

  try {
    await sql`
      UPDATE registrations
      SET
        player1_name = ${player1_name},
        player2_name = ${player2_name ?? null},
        registration_type = ${registration_type},
        status = ${status},
        form_data = ${JSON.stringify(form_data)},
        category = ${category},
        updated_at = NOW()
      WHERE id = ${registrationId}
    `
    return { data: true }
  } catch (e) {
    return { error: String(e) }
  }
}

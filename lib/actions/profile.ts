'use server'

import { auth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { updateProfileSchema } from '@/lib/validations'

export async function getMyProfile() {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { data: null }

  const rows = await sql`SELECT * FROM user_profiles WHERE user_id = ${session.user.id} LIMIT 1`
  if (!rows[0]) {
    const created = await sql`
      INSERT INTO user_profiles (user_id, display_name, category)
      VALUES (${session.user.id}, ${session.user.name ?? session.user.email}, '4a')
      RETURNING *
    `
    return { data: created[0] }
  }
  return { data: rows[0] }
}

export async function updateProfile(input: unknown) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }

  const parsed = updateProfileSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const rows = await sql`
    INSERT INTO user_profiles (user_id, display_name, avatar_url, category)
    VALUES (${session.user.id}, ${d.display_name ?? session.user.name ?? ''}, ${d.avatar_url ?? null}, ${d.category ?? '4a'})
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = COALESCE(${d.display_name ?? null}, user_profiles.display_name),
      avatar_url = COALESCE(${d.avatar_url ?? null}, user_profiles.avatar_url),
      category = COALESCE(${d.category ?? null}, user_profiles.category),
      updated_at = NOW()
    RETURNING *
  `
  return { data: rows[0] }
}

export async function getPublicProfile(userId: string) {
  const rows = await sql`SELECT * FROM user_profiles WHERE user_id = ${userId} LIMIT 1`
  if (!rows[0]) return { error: 'Perfil no encontrado' }

  const tournaments = await sql`
    SELECT t.name, t.start_date, t.status, r.status AS reg_status
    FROM registrations r
    JOIN tournaments t ON t.id = r.tournament_id
    WHERE (r.player1_id = ${userId} OR r.player2_id = ${userId})
    ORDER BY t.start_date DESC
    LIMIT 20
  `

  const stats = await sql`
    SELECT
      count(DISTINCT r.tournament_id)::int AS tournaments_played,
      count(m.id)::int AS matches_played,
      count(CASE WHEN m.winner_reg_id = r.id THEN 1 END)::int AS matches_won
    FROM registrations r
    LEFT JOIN matches m ON (m.team1_reg_id = r.id OR m.team2_reg_id = r.id) AND m.status = 'finished'
    WHERE (r.player1_id = ${userId} OR r.player2_id = ${userId})
  `

  return { data: { profile: rows[0], tournaments, stats: stats[0] } }
}

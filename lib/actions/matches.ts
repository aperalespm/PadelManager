'use server'

import { auth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { submitScoreSchema } from '@/lib/validations'
import { validateMatchScore, MatchConfig } from '@/lib/scoring'
import { generateEliminationFromGroups } from '@/lib/actions/bracket'

export async function submitScore(input: unknown) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }

  const parsed = submitScoreSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { match_id, score } = parsed.data

  const match = await sql`
    SELECT m.*, r1.player1_id AS t1p1, r1.player2_id AS t1p2, r2.player1_id AS t2p1, r2.player2_id AS t2p2,
           ph.score_config
    FROM matches m
    LEFT JOIN registrations r1 ON r1.id = m.team1_reg_id
    LEFT JOIN registrations r2 ON r2.id = m.team2_reg_id
    LEFT JOIN tournament_phases ph ON ph.id = m.phase_id
    WHERE m.id = ${match_id} LIMIT 1
  `
  if (!match[0]) return { error: 'Partido no encontrado' }
  if (match[0].status === 'finished') return { error: 'El partido ya está finalizado' }

  // Validate score against phase match_config if available
  const scoreConfig = match[0].score_config as Record<string, unknown> | null
  if (scoreConfig && scoreConfig.sets_format) {
    const matchConfig: MatchConfig = {
      sets_format: scoreConfig.sets_format as string,
      games_to_win_set: (scoreConfig.games_to_win_set as number) ?? 6,
      deuce_mode: (scoreConfig.deuce_mode as string) ?? 'GOLDEN_POINT',
      deciding_set_format: scoreConfig.deciding_set_format as string | undefined,
      tiebreak_points: scoreConfig.tiebreak_points as number | undefined,
      super_tiebreak_points: scoreConfig.super_tiebreak_points as number | undefined,
      time_limit_minutes: scoreConfig.time_limit_minutes as number | null | undefined,
    }
    const validation = validateMatchScore(score, matchConfig)
    if (!validation.valid) return { error: validation.error ?? 'Marcador inválido' }
  }

  const uid = session.user.id
  const isTeam1 = uid === match[0].t1p1 || uid === match[0].t1p2
  const isTeam2 = uid === match[0].t2p1 || uid === match[0].t2p2
  if (!isTeam1 && !isTeam2) return { error: 'No autorizado' }

  const scoreJson = JSON.stringify(score)

  if (isTeam1) {
    await sql`UPDATE matches SET score_team1 = ${scoreJson}::jsonb, status = 'active', updated_at = NOW() WHERE id = ${match_id}`
  } else {
    await sql`UPDATE matches SET score_team2 = ${scoreJson}::jsonb, status = 'active', updated_at = NOW() WHERE id = ${match_id}`
  }

  const updated = await sql`SELECT * FROM matches WHERE id = ${match_id} LIMIT 1`
  const m = updated[0]
  if (m.score_team1 && m.score_team2) {
    const s1 = m.score_team1 as Array<{ vosotros: number; rival: number }>
    const s2 = m.score_team2 as Array<{ vosotros: number; rival: number }>

    const t1Wins = s1.filter((s, i) => s.vosotros > (s2[i]?.rival ?? 0)).length
    const t2Wins = s1.filter((s, i) => s.rival > (s2[i]?.vosotros ?? 0)).length
    const scoresMatch = s1.length === s2.length && s1.every((s, i) => s.vosotros === s2[i].rival && s.rival === s2[i].vosotros)

    if (scoresMatch) {
      const winner = t1Wins > t2Wins ? m.team1_reg_id : m.team2_reg_id
      await sql`
        UPDATE matches SET
          final_score = score_team1,
          winner_reg_id = ${winner},
          status = 'finished',
          updated_at = NOW()
        WHERE id = ${match_id}
      `
      await advanceWinner(match_id, winner)
    } else {
      await sql`UPDATE matches SET status = 'disputed', updated_at = NOW() WHERE id = ${match_id}`
    }
  }

  return { data: true }
}

export async function validateScore(matchId: string, confirm: boolean) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }

  const match = await sql`
    SELECT m.*, r1.player1_id AS t1p1, r1.player2_id AS t1p2, r2.player1_id AS t2p1, r2.player2_id AS t2p2
    FROM matches m
    LEFT JOIN registrations r1 ON r1.id = m.team1_reg_id
    LEFT JOIN registrations r2 ON r2.id = m.team2_reg_id
    WHERE m.id = ${matchId} LIMIT 1
  `
  if (!match[0]) return { error: 'Partido no encontrado' }
  const uid = session.user.id
  const isParticipant = [match[0].t1p1, match[0].t1p2, match[0].t2p1, match[0].t2p2].includes(uid)
  if (!isParticipant) return { error: 'No autorizado' }

  if (!confirm) {
    await sql`UPDATE matches SET status = 'disputed', updated_at = NOW() WHERE id = ${matchId}`
    return { data: { status: 'disputed' } }
  }

  const m = match[0]
  const s1 = m.score_team1 as Array<{ vosotros: number; rival: number }>
  const t1Wins = s1.filter(s => s.vosotros > s.rival).length
  const t2Wins = s1.filter(s => s.rival > s.vosotros).length
  const winner = t1Wins > t2Wins ? m.team1_reg_id : m.team2_reg_id

  await sql`
    UPDATE matches SET
      final_score = score_team2,
      winner_reg_id = ${winner},
      status = 'finished',
      updated_at = NOW()
    WHERE id = ${matchId}
  `
  await advanceWinner(matchId, winner)
  return { data: { status: 'finished', winner_reg_id: winner } }
}

async function advanceWinner(matchId: string, winnerRegId: string) {
  const match = await sql`SELECT next_match_id, tournament_id FROM matches WHERE id = ${matchId} LIMIT 1`
  if (!match[0]?.next_match_id) {
    await sql`UPDATE tournaments SET status = 'finished', updated_at = NOW() WHERE id = ${match[0].tournament_id}`
    return
  }
  const next = await sql`SELECT * FROM matches WHERE id = ${match[0].next_match_id} LIMIT 1`
  if (!next[0]) return

  if (!next[0].team1_reg_id) {
    await sql`UPDATE matches SET team1_reg_id = ${winnerRegId}, status = 'pending', updated_at = NOW() WHERE id = ${match[0].next_match_id}`
  } else {
    await sql`UPDATE matches SET team2_reg_id = ${winnerRegId}, status = 'pending', updated_at = NOW() WHERE id = ${match[0].next_match_id}`
  }
}

export async function getMatchesForTournament(tournamentId: string) {
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_label TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS category_label TEXT`

  const rows = await sql`
    SELECT m.*,
      ph.name AS phase_name, ph.phase_order, ph.score_config,
      r1.player1_id AS t1p1, r1.player2_id AS t1p2,
      r2.player1_id AS t2p1, r2.player2_id AS t2p2,
      COALESCE(p1a.display_name, r1.player1_name, r1.form_data->>'name') AS t1p1_name,
      COALESCE(p1b.display_name, r1.player2_name, r1.form_data->>'partner_name') AS t1p2_name_display,
      COALESCE(p2a.display_name, r2.player1_name, r2.form_data->>'name') AS t2p1_name,
      COALESCE(p2b.display_name, r2.player2_name, r2.form_data->>'partner_name') AS t2p2_name_display,
      COALESCE(r1.category, r1.form_data->>'category') AS t1_category
    FROM matches m
    JOIN tournament_phases ph ON ph.id = m.phase_id
    LEFT JOIN registrations r1 ON r1.id = m.team1_reg_id
    LEFT JOIN registrations r2 ON r2.id = m.team2_reg_id
    LEFT JOIN user_profiles p1a ON p1a.user_id = r1.player1_id
    LEFT JOIN user_profiles p1b ON p1b.user_id = r1.player2_id
    LEFT JOIN user_profiles p2a ON p2a.user_id = r2.player1_id
    LEFT JOIN user_profiles p2b ON p2b.user_id = r2.player2_id
    WHERE m.tournament_id = ${tournamentId}
    ORDER BY ph.phase_order ASC, m.scheduled_at ASC NULLS LAST, m.round ASC, m.match_number ASC
  `
  return rows
}

export async function submitMatchResult(
  matchId: string,
  scores: Array<{ t1: number; t2: number }>
): Promise<{ data: { allGroupsDone: boolean } } | { error: string }> {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }

  if (!scores || scores.length === 0) return { error: 'Introduce al menos un set' }

  const rows = await sql`
    SELECT m.*, t.organizer_id, t.id AS tid, t.venue_details
    FROM matches m
    JOIN tournaments t ON t.id = m.tournament_id
    WHERE m.id = ${matchId} LIMIT 1
  `
  if (!rows[0]) return { error: 'Partido no encontrado' }
  const m = rows[0] as Record<string, unknown>
  if (m.organizer_id !== session.user.id) return { error: 'No autorizado' }
  if (!m.team1_reg_id || !m.team2_reg_id) return { error: 'El partido aún no tiene los dos equipos asignados' }

  let t1Sets = 0, t2Sets = 0
  for (const s of scores) {
    if (s.t1 > s.t2) t1Sets++
    else if (s.t2 > s.t1) t2Sets++
  }
  if (t1Sets === t2Sets) return { error: 'El resultado no tiene ganador claro (sets empatados)' }

  const winnerId = t1Sets > t2Sets ? (m.team1_reg_id as string) : (m.team2_reg_id as string)
  const finalScore = scores.map(s => ({ vosotros: s.t1, rival: s.t2 }))

  await sql`
    UPDATE matches SET
      final_score = ${JSON.stringify(finalScore)}::jsonb,
      winner_reg_id = ${winnerId},
      status = 'finished',
      updated_at = NOW()
    WHERE id = ${matchId}
  `

  const isGroupMatch = !!(m.group_label as string | null)

  if (isGroupMatch) {
    const pending = await sql`
      SELECT count(*)::int AS n FROM matches
      WHERE tournament_id = ${m.tid as string}
        AND group_label IS NOT NULL
        AND status != 'finished'
        AND id != ${matchId}
    `
    const allDone = ((pending[0]?.n as number) ?? 1) === 0
    if (allDone) {
      await generateEliminationFromGroups(m.tid as string)
    }
    return { data: { allGroupsDone: allDone } }
  } else {
    await advanceWinner(matchId, winnerId)
    return { data: { allGroupsDone: false } }
  }
}

export async function getMatchCountForTournament(tournamentId: string): Promise<number> {
  const rows = await sql`SELECT count(*)::int AS n FROM matches WHERE tournament_id = ${tournamentId}`
  return (rows[0]?.n as number) ?? 0
}

export async function adminOverrideScore(matchId: string, winnerId: string, finalScore: unknown) {
  const { data: session } = await auth.getSession()
  if (!session?.user) return { error: 'No autorizado' }
  const m = await sql`SELECT m.*, t.organizer_id FROM matches m JOIN tournaments t ON t.id = m.tournament_id WHERE m.id = ${matchId} LIMIT 1`
  if (!m[0] || m[0].organizer_id !== session.user.id) return { error: 'No autorizado' }

  await sql`
    UPDATE matches SET
      winner_reg_id = ${winnerId},
      final_score = ${JSON.stringify(finalScore)}::jsonb,
      status = 'finished',
      updated_at = NOW()
    WHERE id = ${matchId}
  `
  await advanceWinner(matchId, winnerId)
  return { data: true }
}

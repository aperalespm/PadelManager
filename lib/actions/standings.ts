'use server'

import { sql } from '@/lib/db'

export interface StandingRow {
  registration_id: string
  player1_name: string
  player2_name: string
  played: number
  won: number
  lost: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
  points: number
}

type SetScore = { vosotros: number; rival: number }

export async function getStandings(tournamentId: string): Promise<StandingRow[]> {
  // Get tournament format config
  const tournRows = await sql`
    SELECT format, venue_details FROM tournaments WHERE id = ${tournamentId} LIMIT 1
  `
  if (!tournRows[0]) return []

  const t = tournRows[0] as Record<string, unknown>
  const format = t.format as string
  if (format !== 'american' && format !== 'groups_elimination') return []

  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const scoringSystem = (vd.scoring_system as string) ?? 'WIN_LOSS'
  const tiebreakCriteria = (vd.tiebreak_criteria as string[]) ?? [
    'HEAD_TO_HEAD',
    'SET_DIFFERENCE',
    'GAME_DIFFERENCE',
    'RANDOM',
  ]

  // Get all finished matches
  const matchRows = await sql`
    SELECT m.id, m.team1_reg_id, m.team2_reg_id, m.winner_reg_id, m.final_score,
           r1.player1_id AS t1p1_id, r1.player2_id AS t1p2_id,
           r2.player1_id AS t2p1_id, r2.player2_id AS t2p2_id,
           p1a.display_name AS t1p1_name, p1b.display_name AS t1p2_name,
           p2a.display_name AS t2p1_name, p2b.display_name AS t2p2_name
    FROM matches m
    LEFT JOIN registrations r1 ON r1.id = m.team1_reg_id
    LEFT JOIN registrations r2 ON r2.id = m.team2_reg_id
    LEFT JOIN user_profiles p1a ON p1a.user_id = r1.player1_id
    LEFT JOIN user_profiles p1b ON p1b.user_id = r1.player2_id
    LEFT JOIN user_profiles p2a ON p2a.user_id = r2.player1_id
    LEFT JOIN user_profiles p2b ON p2b.user_id = r2.player2_id
    WHERE m.tournament_id = ${tournamentId} AND m.status = 'finished'
      AND m.team1_reg_id IS NOT NULL AND m.team2_reg_id IS NOT NULL
  `

  // Build registry of all teams
  const teamsMap = new Map<string, { player1_name: string; player2_name: string }>()
  for (const m of matchRows) {
    const row = m as Record<string, unknown>
    if (row.team1_reg_id) {
      teamsMap.set(row.team1_reg_id as string, {
        player1_name: (row.t1p1_name as string) ?? '',
        player2_name: (row.t1p2_name as string) ?? '',
      })
    }
    if (row.team2_reg_id) {
      teamsMap.set(row.team2_reg_id as string, {
        player1_name: (row.t2p1_name as string) ?? '',
        player2_name: (row.t2p2_name as string) ?? '',
      })
    }
  }

  // Initialize standings
  const standings = new Map<string, StandingRow>()
  for (const [regId, names] of teamsMap) {
    standings.set(regId, {
      registration_id: regId,
      player1_name: names.player1_name,
      player2_name: names.player2_name,
      played: 0,
      won: 0,
      lost: 0,
      sets_won: 0,
      sets_lost: 0,
      games_won: 0,
      games_lost: 0,
      points: 0,
    })
  }

  // Parse match results and accumulate stats
  for (const m of matchRows) {
    const row = m as Record<string, unknown>
    const t1 = row.team1_reg_id as string
    const t2 = row.team2_reg_id as string
    const winner = row.winner_reg_id as string
    const finalScore = row.final_score as SetScore[] | null

    if (!standings.has(t1) || !standings.has(t2)) continue

    const s1 = standings.get(t1)!
    const s2 = standings.get(t2)!

    s1.played++
    s2.played++

    const t1Won = winner === t1

    if (t1Won) {
      s1.won++
      s2.lost++
    } else {
      s2.won++
      s1.lost++
    }

    // Points from scoring system
    if (scoringSystem === 'WIN_LOSS') {
      if (t1Won) s1.points += 2
      else s2.points += 2
    }

    // Parse sets/games from final_score
    if (finalScore && Array.isArray(finalScore)) {
      for (const setScore of finalScore) {
        const v = setScore.vosotros ?? 0
        const r = setScore.rival ?? 0
        s1.games_won += v
        s1.games_lost += r
        s2.games_won += r
        s2.games_lost += v
        if (v > r) {
          s1.sets_won++
          s2.sets_lost++
        } else if (r > v) {
          s2.sets_won++
          s1.sets_lost++
        }
      }

      if (scoringSystem === 'GAMES_WON') {
        s1.points = s1.games_won
        s2.points = s2.games_won
      } else if (scoringSystem === 'SETS_WON') {
        s1.points = s1.sets_won
        s2.points = s2.sets_won
      } else if (scoringSystem === 'POINTS_SCORED') {
        // Sum all individual game scores as points
        const t1Points = finalScore.reduce((acc, ss) => acc + (ss.vosotros ?? 0), 0)
        const t2Points = finalScore.reduce((acc, ss) => acc + (ss.rival ?? 0), 0)
        s1.points += t1Points
        s2.points += t2Points
      }
    }
  }

  // Convert to array and sort by tiebreak criteria
  let rows = Array.from(standings.values())

  // Sort by primary metric first (points / wins)
  rows.sort((a, b) => {
    // Always sort by wins/points first
    if (b.points !== a.points) return b.points - a.points

    // Apply tiebreak criteria in order
    for (const criterion of tiebreakCriteria) {
      let diff = 0
      if (criterion === 'SET_DIFFERENCE') {
        diff = (b.sets_won - b.sets_lost) - (a.sets_won - a.sets_lost)
      } else if (criterion === 'GAME_DIFFERENCE') {
        diff = (b.games_won - b.games_lost) - (a.games_won - a.games_lost)
      } else if (criterion === 'GAMES_WON') {
        diff = b.games_won - a.games_won
      } else if (criterion === 'POINTS_DIFFERENCE') {
        diff = (b.games_won - b.games_lost) - (a.games_won - a.games_lost)
      } else if (criterion === 'RANDOM') {
        diff = a.registration_id < b.registration_id ? -1 : 1
      }
      // HEAD_TO_HEAD would require additional match lookup; skip for now
      if (diff !== 0) return diff
    }
    return 0
  })

  return rows
}

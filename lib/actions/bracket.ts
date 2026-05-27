'use server'

import { sql } from '@/lib/db'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

export async function generateBracket(tournamentId: string) {
  const t = await sql`SELECT * FROM tournaments WHERE id = ${tournamentId} LIMIT 1`
  if (!t[0]) return { error: 'Torneo no encontrado' }

  const phases = await sql`SELECT * FROM tournament_phases WHERE tournament_id = ${tournamentId} ORDER BY phase_order ASC`
  if (!phases.length) return { error: 'Configura las fases primero' }

  const regs = await sql`SELECT * FROM registrations WHERE tournament_id = ${tournamentId} AND status = 'confirmed'`
  if (regs.length < 2) return { error: 'Se necesitan al menos 2 parejas confirmadas' }

  await sql`DELETE FROM matches WHERE tournament_id = ${tournamentId}`

  const format = t[0].format
  const firstPhase = phases[0]
  const shuffled = shuffle(regs)
  const courts = (t[0].venue_details as Record<string, unknown>)?.courts as string[] | undefined ?? ['Pista 1', 'Pista 2', 'Pista 3', 'Pista 4']
  let courtIdx = 0
  const baseTime = new Date(t[0].start_date)
  let timeOffset = 0

  if (format === 'elimination' || format === 'groups_elimination') {
    const size = nextPowerOf2(shuffled.length)
    const byes = size - shuffled.length
    const padded = [...shuffled, ...Array(byes).fill(null)]
    const matchIds: (string | null)[][] = []
    const numRounds = Math.log2(size)

    for (let round = numRounds; round >= 1; round--) {
      const numMatches = Math.pow(2, round - 1)
      matchIds[round] = []
      for (let m = 0; m < numMatches; m++) {
        const scheduledAt = new Date(baseTime.getTime() + timeOffset * 60000)
        const court = courts[courtIdx % courts.length]
        courtIdx++
        if (m % courts.length === courts.length - 1) timeOffset += 90

        const nextMatchId = round < numRounds ? matchIds[round + 1][Math.floor(m / 2)] : null

        const t1 = round === numRounds ? padded[m * 2] : null
        const t2 = round === numRounds ? padded[m * 2 + 1] : null

        if (t1 === null && t2 === null && round === numRounds) {
          matchIds[round][m] = null
          continue
        }

        const auto_advance = t1 === null || t2 === null
        const winner = t1 !== null ? t1 : t2

        const rows = await sql`
          INSERT INTO matches (tournament_id, phase_id, round, match_number, team1_reg_id, team2_reg_id, court_name, scheduled_at, next_match_id, status)
          VALUES (${tournamentId}, ${firstPhase.id}, ${numRounds - round + 1}, ${m + 1}, ${t1?.id ?? null}, ${t2?.id ?? null}, ${court}, ${scheduledAt.toISOString()}, ${nextMatchId}, ${auto_advance ? 'bye' : 'pending'})
          RETURNING id
        `
        matchIds[round][m] = rows[0].id

        if (auto_advance && winner && nextMatchId) {
          await sql`
            UPDATE matches SET team1_reg_id = ${winner.id}, updated_at = NOW() WHERE id = ${nextMatchId}
          `
        }
      }
    }
  } else if (format === 'round_robin') {
    let matchNum = 1
    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        const scheduledAt = new Date(baseTime.getTime() + timeOffset * 60000)
        const court = courts[courtIdx % courts.length]
        courtIdx++
        if (matchNum % courts.length === 0) timeOffset += 90
        await sql`
          INSERT INTO matches (tournament_id, phase_id, round, match_number, team1_reg_id, team2_reg_id, court_name, scheduled_at, status)
          VALUES (${tournamentId}, ${firstPhase.id}, 1, ${matchNum}, ${shuffled[i].id}, ${shuffled[j].id}, ${court}, ${scheduledAt.toISOString()}, 'pending')
        `
        matchNum++
      }
    }
  }

  await sql`UPDATE tournaments SET status = 'active', updated_at = NOW() WHERE id = ${tournamentId}`
  return { data: true }
}

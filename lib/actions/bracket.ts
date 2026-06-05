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

export async function generateGroupBracket(tournamentId: string) {
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_label TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS category_label TEXT`

  const tRows = await sql`SELECT * FROM tournaments WHERE id = ${tournamentId} LIMIT 1`
  if (!tRows[0]) return { error: 'Torneo no encontrado' }
  const t = tRows[0]

  const phases = await sql`SELECT * FROM tournament_phases WHERE tournament_id = ${tournamentId} ORDER BY phase_order ASC`
  if (!phases.length) return { error: 'Configura las fases primero' }

  const regs = await sql`SELECT * FROM registrations WHERE tournament_id = ${tournamentId} AND status = 'confirmed'`
  if (regs.length < 2) return { error: 'Se necesitan al menos 2 parejas confirmadas' }

  await sql`DELETE FROM matches WHERE tournament_id = ${tournamentId}`

  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const numGroups = Math.max(1, parseInt(String(vd.num_groups ?? '3')) || 3)

  // Group registrations by category from form_data
  const catMap: Record<string, typeof regs> = {}
  for (const r of regs) {
    const fd = (r.form_data as Record<string, unknown>) ?? {}
    const cat = (fd.category as string) || ''
    if (!catMap[cat]) catMap[cat] = []
    catMap[cat].push(r)
  }

  const groupsPhase = phases[0]
  let matchNum = 1
  const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  for (const [catLabel, catRegs] of Object.entries(catMap)) {
    const shuffled = shuffle([...catRegs])
    const actualGroups = Math.max(1, Math.min(numGroups, Math.floor(shuffled.length / 2)))

    const groups: (typeof regs)[] = Array.from({ length: actualGroups }, () => [])
    shuffled.forEach((reg, i) => { groups[i % actualGroups].push(reg) })

    for (let g = 0; g < actualGroups; g++) {
      const group = groups[g]
      const groupLabel = `Grupo ${groupLetters[g]}`
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          await sql`
            INSERT INTO matches (
              tournament_id, phase_id, round, match_number,
              team1_reg_id, team2_reg_id,
              group_label, category_label, status
            ) VALUES (
              ${tournamentId}, ${groupsPhase.id}, ${g + 1}, ${matchNum},
              ${group[i].id}, ${group[j].id},
              ${groupLabel}, ${catLabel || null}, 'pending'
            )
          `
          matchNum++
        }
      }
    }
  }

  await sql`UPDATE tournaments SET updated_at = NOW() WHERE id = ${tournamentId}`
  return { data: true }
}

export async function getGroupBracketData(tournamentId: string) {
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_label TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS category_label TEXT`

  const [t1Rows, t2Rows] = await Promise.all([
    sql`
      SELECT DISTINCT
        m.group_label,
        COALESCE(m.category_label, '') AS category_label,
        r.id AS reg_id,
        CASE
          WHEN p1.display_name IS NOT NULL
          THEN p1.display_name || ' / ' || COALESCE(p2.display_name, r.player2_name, '?')
          ELSE COALESCE(r.player1_name, '?') || ' / ' || COALESCE(r.player2_name, '?')
        END AS pair_name
      FROM matches m
      JOIN registrations r ON r.id = m.team1_reg_id
      LEFT JOIN user_profiles p1 ON p1.user_id = r.player1_id
      LEFT JOIN user_profiles p2 ON p2.user_id = r.player2_id
      WHERE m.tournament_id = ${tournamentId} AND m.group_label IS NOT NULL
    `,
    sql`
      SELECT DISTINCT
        m.group_label,
        COALESCE(m.category_label, '') AS category_label,
        r.id AS reg_id,
        CASE
          WHEN p1.display_name IS NOT NULL
          THEN p1.display_name || ' / ' || COALESCE(p2.display_name, r.player2_name, '?')
          ELSE COALESCE(r.player1_name, '?') || ' / ' || COALESCE(r.player2_name, '?')
        END AS pair_name
      FROM matches m
      JOIN registrations r ON r.id = m.team2_reg_id
      LEFT JOIN user_profiles p1 ON p1.user_id = r.player1_id
      LEFT JOIN user_profiles p2 ON p2.user_id = r.player2_id
      WHERE m.tournament_id = ${tournamentId} AND m.group_label IS NOT NULL
    `,
  ])

  // Merge and deduplicate
  const seen = new Set<string>()
  const allRows = [...t1Rows, ...t2Rows].filter(r => {
    const key = `${r.category_label}|${r.group_label}|${r.reg_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Build structure: { [categoryLabel]: { [groupLabel]: { id, name }[] } }
  const catMap: Record<string, Record<string, Array<{ id: string; name: string }>>> = {}
  for (const row of allRows) {
    const cat = (row.category_label as string) || ''
    const grp = row.group_label as string
    if (!catMap[cat]) catMap[cat] = {}
    if (!catMap[cat][grp]) catMap[cat][grp] = []
    catMap[cat][grp].push({ id: row.reg_id as string, name: row.pair_name as string })
  }

  return { data: catMap }
}

'use server'

import { sql } from '@/lib/db'
import { computeOptimalFormats } from '@/lib/schedule/generator'

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

// ── Auto-generate KO bracket from group standings ────────────────────────────
// Preserves group match results (only deletes KO matches where group_label IS NULL)

export async function generateEliminationFromGroups(tournamentId: string) {
  const tRows = await sql`SELECT * FROM tournaments WHERE id = ${tournamentId} LIMIT 1`
  if (!tRows[0]) return { error: 'Torneo no encontrado' }

  const phases = await sql`SELECT * FROM tournament_phases WHERE tournament_id = ${tournamentId} ORDER BY phase_order ASC`
  if (!phases.length) return { error: 'No hay fases configuradas' }
  const koPhase = phases[phases.length - 1]

  const vd = (tRows[0].venue_details as Record<string, unknown>) ?? {}
  const scoringSystem = (vd.scoring_system as string) ?? 'WIN_LOSS'
  const tiebreakCriteria = (vd.tiebreak_criteria as string[]) ?? ['SET_DIFFERENCE', 'GAME_DIFFERENCE', 'RANDOM']
  const teamsAdvancing = (vd.teams_advancing_per_group as number) ?? 2
  const courts = (vd.courts as string[]) ?? ['Pista 1', 'Pista 2', 'Pista 3', 'Pista 4']

  // Get all finished group matches
  const groupMatches = await sql`
    SELECT m.team1_reg_id, m.team2_reg_id, m.winner_reg_id, m.final_score,
           m.group_label, m.category_label, m.scheduled_at
    FROM matches m
    WHERE m.tournament_id = ${tournamentId}
      AND m.group_label IS NOT NULL
      AND m.status = 'finished'
  `

  type TeamStats = {
    regId: string; groupLabel: string; categoryLabel: string
    played: number; won: number; lost: number
    setsWon: number; setsLost: number; gamesWon: number; gamesLost: number; points: number
  }

  const teamStats = new Map<string, TeamStats>()

  const ensure = (regId: string, grp: string, cat: string) => {
    if (!teamStats.has(regId)) {
      teamStats.set(regId, { regId, groupLabel: grp, categoryLabel: cat, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, points: 0 })
    }
    return teamStats.get(regId)!
  }

  let latestMatchTime: Date | null = null

  for (const row of groupMatches) {
    const m = row as Record<string, unknown>
    const t1 = m.team1_reg_id as string; const t2 = m.team2_reg_id as string
    const grp = m.group_label as string; const cat = m.category_label as string
    if (!t1 || !t2) continue
    const s1 = ensure(t1, grp, cat); const s2 = ensure(t2, grp, cat)
    s1.played++; s2.played++
    const t1Won = (m.winner_reg_id as string) === t1
    if (t1Won) { s1.won++; s2.lost++ } else { s2.won++; s1.lost++ }
    if (scoringSystem === 'WIN_LOSS') { if (t1Won) s1.points += 2; else s2.points += 2 }
    const fs = m.final_score as Array<{ vosotros: number; rival: number }> | null
    if (fs) {
      for (const set of fs) {
        s1.gamesWon += set.vosotros; s1.gamesLost += set.rival
        s2.gamesWon += set.rival; s2.gamesLost += set.vosotros
        if (set.vosotros > set.rival) { s1.setsWon++; s2.setsLost++ }
        else if (set.rival > set.vosotros) { s2.setsWon++; s1.setsLost++ }
      }
      if (scoringSystem === 'GAMES_WON') { s1.points = s1.gamesWon; s2.points = s2.gamesWon }
      else if (scoringSystem === 'SETS_WON') { s1.points = s1.setsWon; s2.points = s2.setsWon }
    }
    if (m.scheduled_at) {
      const d = new Date(m.scheduled_at as string)
      if (!latestMatchTime || d > latestMatchTime) latestMatchTime = d
    }
  }

  function sortGroup(teams: TeamStats[]) {
    return [...teams].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      for (const criterion of tiebreakCriteria) {
        let diff = 0
        if (criterion === 'SET_DIFFERENCE') diff = (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost)
        else if (criterion === 'GAME_DIFFERENCE') diff = (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost)
        else if (criterion === 'GAMES_WON') diff = b.gamesWon - a.gamesWon
        else if (criterion === 'RANDOM') diff = a.regId < b.regId ? -1 : 1
        if (diff !== 0) return diff
      }
      return 0
    })
  }

  // Group teams by (category, group), sort within group, collect advancers
  const catGroupMap = new Map<string, Map<string, TeamStats[]>>()
  for (const [, stats] of teamStats) {
    if (!catGroupMap.has(stats.categoryLabel)) catGroupMap.set(stats.categoryLabel, new Map())
    const cg = catGroupMap.get(stats.categoryLabel)!
    if (!cg.has(stats.groupLabel)) cg.set(stats.groupLabel, [])
    cg.get(stats.groupLabel)!.push(stats)
  }

  // Collect seeds per category: for CRUZADO, interleave by rank then group
  const seedsByCategory = new Map<string, string[]>()
  for (const [cat, groupMap] of catGroupMap) {
    const groups = [...groupMap.entries()].sort(([a], [b]) => a.localeCompare(b))
    const seeds: string[] = []
    for (let rank = 0; rank < teamsAdvancing; rank++) {
      for (const [, teams] of groups) {
        const sorted = sortGroup(teams)
        if (sorted[rank]) seeds.push(sorted[rank].regId)
      }
    }
    seedsByCategory.set(cat, seeds)
  }

  // Delete only KO matches (preserve group results)
  await sql`DELETE FROM matches WHERE tournament_id = ${tournamentId} AND group_label IS NULL`

  // KO start time: 60 min after latest group match (or start_date + 4h as fallback)
  const baseKOTime = latestMatchTime
    ? new Date(latestMatchTime.getTime() + 60 * 60 * 1000)
    : new Date(new Date(tRows[0].start_date as string).getTime() + 4 * 60 * 60 * 1000)

  let courtIdx = 0; let timeOffset = 0; let matchNum = 1

  for (const [, seeds] of seedsByCategory) {
    if (seeds.length < 2) continue
    const size = nextPowerOf2(seeds.length)
    const padded: (string | null)[] = [...seeds, ...Array(size - seeds.length).fill(null)]
    const matchIds: (string | null)[][] = []
    const numRounds = Math.log2(size)

    for (let round = numRounds; round >= 1; round--) {
      const numMatches = Math.pow(2, round - 1)
      matchIds[round] = []
      for (let mi = 0; mi < numMatches; mi++) {
        const scheduledAt = new Date(baseKOTime.getTime() + timeOffset * 60000)
        const court = courts[courtIdx % courts.length]
        courtIdx++
        if (mi % courts.length === courts.length - 1) timeOffset += 90

        const nextMatchId = round < numRounds ? matchIds[round + 1][Math.floor(mi / 2)] : null
        const t1 = round === numRounds ? padded[mi * 2] : null
        const t2 = round === numRounds ? padded[mi * 2 + 1] : null

        if (t1 === null && t2 === null && round === numRounds) { matchIds[round][mi] = null; continue }

        const auto_advance = t1 === null || t2 === null
        const winner = t1 ?? t2

        const inserted = await sql`
          INSERT INTO matches (tournament_id, phase_id, round, match_number, team1_reg_id, team2_reg_id, court_name, scheduled_at, next_match_id, status)
          VALUES (${tournamentId}, ${koPhase.id}, ${numRounds - round + 1}, ${matchNum++}, ${t1}, ${t2}, ${court}, ${scheduledAt.toISOString()}, ${nextMatchId}, ${auto_advance ? 'bye' : 'pending'})
          RETURNING id
        `
        matchIds[round][mi] = inserted[0].id
        if (auto_advance && winner && nextMatchId) {
          await sql`UPDATE matches SET team1_reg_id = ${winner}, updated_at = NOW() WHERE id = ${nextMatchId}`
        }
      }
    }
  }

  await sql`UPDATE tournaments SET status = 'active', updated_at = NOW() WHERE id = ${tournamentId}`
  return { data: true }
}

// ── Generate bracket using AI schedule group assignments ─────────────────────

export async function generateGroupBracketFromSchedule(tournamentId: string) {
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_label TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS category_label TEXT`

  const tRows = await sql`SELECT * FROM tournaments WHERE id = ${tournamentId} LIMIT 1`
  if (!tRows[0]) return { error: 'Torneo no encontrado' }

  const phases = await sql`SELECT * FROM tournament_phases WHERE tournament_id = ${tournamentId} ORDER BY phase_order ASC`
  if (!phases.length) return { error: 'Configura las fases primero' }
  const groupsPhase = phases[0]

  // Load saved schedule
  const scheduleRows = await sql`SELECT schedule_data FROM tournament_schedules WHERE tournament_id = ${tournamentId} LIMIT 1`
  if (!scheduleRows[0]) return { error: 'No hay horario guardado. Genera y guarda el horario primero.' }

  const scheduleMatches = (scheduleRows[0].schedule_data as Record<string, unknown>).matches as Array<Record<string, unknown>> | undefined
  if (!scheduleMatches?.length) return { error: 'El horario guardado no tiene partidos.' }

  // Extract group assignments from groups-phase matches:
  // { categoryName: { groupLabel: Set<pairName> } }
  const groupAssignments: Record<string, Record<string, Set<string>>> = {}
  for (const m of scheduleMatches) {
    if (m.phase !== 'groups') continue
    const cat = (m.categoryName as string) ?? ''
    const label = (m.matchLabel as string) ?? ''
    const grMatch = label.match(/\bGr\.([A-Z]+)\b/)
    if (!grMatch) continue
    const groupLabel = `Grupo ${grMatch[1]}`

    if (!groupAssignments[cat]) groupAssignments[cat] = {}
    if (!groupAssignments[cat][groupLabel]) groupAssignments[cat][groupLabel] = new Set()
    if (m.pair1) groupAssignments[cat][groupLabel].add((m.pair1 as string).trim())
    if (m.pair2) groupAssignments[cat][groupLabel].add((m.pair2 as string).trim())
  }

  if (Object.keys(groupAssignments).length === 0) {
    return { error: 'El horario no tiene asignaciones de grupo. Regénéralo con las parejas inscritas.' }
  }

  // Build name → registration_id map (same name format as getConfirmedPairsForSchedule)
  const regs = await sql`
    SELECT
      r.id, r.form_data,
      CASE
        WHEN r.player2_name IS NOT NULL OR p2.display_name IS NOT NULL
        THEN COALESCE(p1.display_name, r.player1_name, '?') || ' / ' || COALESCE(p2.display_name, r.player2_name)
        ELSE COALESCE(p1.display_name, r.player1_name, '?')
      END AS pair_name
    FROM registrations r
    LEFT JOIN user_profiles p1 ON p1.user_id = r.player1_id
    LEFT JOIN user_profiles p2 ON p2.user_id = r.player2_id
    WHERE r.tournament_id = ${tournamentId} AND r.status = 'confirmed'
  `

  const nameToRegId = new Map<string, string>()
  for (const r of regs) nameToRegId.set((r.pair_name as string).trim(), r.id as string)

  // Verify we can match at least 2 pairs; fall back to random if schedule has only placeholders
  const matchableCount = [...new Set(
    Object.values(groupAssignments).flatMap(groups =>
      Object.values(groups).flatMap(s => [...s])
    )
  )].filter(name => nameToRegId.has(name)).length

  if (matchableCount < 2) {
    // Schedule was generated with generic names — fall back to random assignment
    return generateGroupBracket(tournamentId)
  }

  await sql`DELETE FROM matches WHERE tournament_id = ${tournamentId}`

  let matchNum = 1

  for (const [catLabel, groups] of Object.entries(groupAssignments)) {
    for (const [groupLabel, pairNames] of Object.entries(groups)) {
      const groupRegIds: string[] = []
      for (const name of pairNames) {
        const regId = nameToRegId.get(name)
        if (regId) groupRegIds.push(regId)
      }
      if (groupRegIds.length < 2) continue

      for (let i = 0; i < groupRegIds.length; i++) {
        for (let j = i + 1; j < groupRegIds.length; j++) {
          await sql`
            INSERT INTO matches (
              tournament_id, phase_id, round, match_number,
              team1_reg_id, team2_reg_id,
              group_label, category_label, status
            ) VALUES (
              ${tournamentId}, ${groupsPhase.id}, 1, ${matchNum},
              ${groupRegIds[i]}, ${groupRegIds[j]},
              ${groupLabel}, ${catLabel || null}, 'pending'
            )
          `
          matchNum++
        }
      }
    }
  }

  if (matchNum === 1) {
    // Nothing was inserted — fall back
    return generateGroupBracket(tournamentId)
  }

  await sql`UPDATE tournaments SET updated_at = NOW() WHERE id = ${tournamentId}`
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
  const catFormats = computeOptimalFormats(vd)
  const fallbackNumGroups = Math.max(1, parseInt(String(vd.num_groups ?? '2')) || 2)

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
    const numGroups = catFormats[catLabel]?.numGroups ?? fallbackNumGroups
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

// ── Update: add new confirmed registrations to existing groups ────────────────

export async function updateGroupBracket(tournamentId: string) {
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_label TEXT`
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS category_label TEXT`

  const tRows = await sql`SELECT * FROM tournaments WHERE id = ${tournamentId} LIMIT 1`
  if (!tRows[0]) return { error: 'Torneo no encontrado' }
  const t = tRows[0]

  const phases = await sql`SELECT * FROM tournament_phases WHERE tournament_id = ${tournamentId} ORDER BY phase_order ASC`
  if (!phases.length) return { error: 'Configura las fases primero' }
  const groupsPhase = phases[0]

  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const teamsPerGroup = Math.max(1, parseInt(String(vd.teams_per_group ?? '3')) || 3)
  const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  // All confirmed registrations
  const allConfirmed = await sql`SELECT * FROM registrations WHERE tournament_id = ${tournamentId} AND status = 'confirmed'`

  // Registrations already present in any match
  const inMatches = await sql`
    SELECT DISTINCT unnest(ARRAY[team1_reg_id, team2_reg_id]) AS reg_id
    FROM matches
    WHERE tournament_id = ${tournamentId}
      AND (team1_reg_id IS NOT NULL OR team2_reg_id IS NOT NULL)
  `
  const alreadyIds = new Set(inMatches.map(r => r.reg_id as string).filter(Boolean))

  const newRegs = allConfirmed.filter(r => !alreadyIds.has(r.id as string))
  if (newRegs.length === 0) return { data: true }

  // Build group structure from existing matches: cat → groupLabel → reg_id[]
  const existing = await sql`
    SELECT group_label, COALESCE(category_label, '') AS category_label, team1_reg_id AS reg_id
    FROM matches WHERE tournament_id = ${tournamentId} AND team1_reg_id IS NOT NULL AND group_label IS NOT NULL
    UNION
    SELECT group_label, COALESCE(category_label, '') AS category_label, team2_reg_id AS reg_id
    FROM matches WHERE tournament_id = ${tournamentId} AND team2_reg_id IS NOT NULL AND group_label IS NOT NULL
  `
  const groupStructure: Record<string, Record<string, string[]>> = {}
  for (const row of existing) {
    const cat = row.category_label as string
    const grp = row.group_label as string
    if (!groupStructure[cat]) groupStructure[cat] = {}
    if (!groupStructure[cat][grp]) groupStructure[cat][grp] = []
    if (!groupStructure[cat][grp].includes(row.reg_id as string)) {
      groupStructure[cat][grp].push(row.reg_id as string)
    }
  }

  // Group new regs by category
  const newByCat: Record<string, typeof newRegs> = {}
  for (const r of newRegs) {
    const fd = (r.form_data as Record<string, unknown>) ?? {}
    const cat = (fd.category as string) || ''
    if (!newByCat[cat]) newByCat[cat] = []
    newByCat[cat].push(r)
  }

  const maxMatchNum = await sql`SELECT COALESCE(MAX(match_number), 0) AS n FROM matches WHERE tournament_id = ${tournamentId}`
  let matchNum = (maxMatchNum[0].n as number) + 1

  for (const [catLabel, catNewRegs] of Object.entries(newByCat)) {
    if (!groupStructure[catLabel]) groupStructure[catLabel] = {}
    const catGroups = groupStructure[catLabel]

    for (const newReg of catNewRegs) {
      // Find group with fewest teams that still has room
      let targetGroup: string | null = null
      let minSize = Infinity
      for (const [grpLabel, regIds] of Object.entries(catGroups)) {
        if (regIds.length < teamsPerGroup && regIds.length < minSize) {
          minSize = regIds.length
          targetGroup = grpLabel
        }
      }
      // No room in any existing group — create a new one
      if (!targetGroup) {
        const nextIdx = Object.keys(catGroups).length
        targetGroup = `Grupo ${groupLetters[nextIdx] ?? nextIdx}`
        catGroups[targetGroup] = []
      }

      const existingInGroup = [...catGroups[targetGroup]]
      catGroups[targetGroup].push(newReg.id as string)

      // New reg vs each already-in-group reg
      for (const existingId of existingInGroup) {
        await sql`
          INSERT INTO matches (
            tournament_id, phase_id, round, match_number,
            team1_reg_id, team2_reg_id,
            group_label, category_label, status
          ) VALUES (
            ${tournamentId}, ${groupsPhase.id}, 1, ${matchNum},
            ${existingId}, ${newReg.id as string},
            ${targetGroup}, ${catLabel || null}, 'pending'
          )
        `
        matchNum++
      }
    }
  }

  await sql`UPDATE tournaments SET updated_at = NOW() WHERE id = ${tournamentId}`
  return { data: true }
}

// ── Draft preview: slot layout with confirmed pairs + placeholders ─────────────

export async function getGroupBracketDraftData(tournamentId: string) {
  const tRows = await sql`SELECT * FROM tournaments WHERE id = ${tournamentId} LIMIT 1`
  if (!tRows[0]) return { data: {} as Record<string, Record<string, Array<{ id: string; name: string }>>> }
  const t = tRows[0]

  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const catFormats = computeOptimalFormats(vd)
  const fallbackNumGroups = Math.max(1, parseInt(String(vd.num_groups ?? '2')) || 2)
  const fallbackTPG = Math.max(2, parseInt(String(vd.teams_per_group ?? '3')) || 3)
  const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  // Expand configured categories (same logic as the page)
  const rawCats = (vd.categories as Array<{ name: string; genders?: string[] }>) ?? []
  const categoryNames: string[] = []
  for (const cat of rawCats) {
    if (!cat.name?.trim()) continue
    if (!cat.genders || cat.genders.length === 0) {
      categoryNames.push(cat.name)
    } else {
      for (const g of cat.genders) {
        const suffix = g === 'M' ? ' Masculino' : g === 'F' ? ' Femenino' : ' Mixto'
        categoryNames.push(cat.name + suffix)
      }
    }
  }

  // Confirmed registrations with display names
  const regs = await sql`
    SELECT
      r.id, r.form_data, r.player1_id, r.player2_id,
      r.player1_name, r.player2_name,
      CASE
        WHEN r.player2_name IS NOT NULL OR p2.display_name IS NOT NULL
        THEN COALESCE(p1.display_name, r.player1_name, '?') || ' / ' || COALESCE(p2.display_name, r.player2_name)
        ELSE COALESCE(p1.display_name, r.player1_name, '?')
      END AS pair_name
    FROM registrations r
    LEFT JOIN user_profiles p1 ON p1.user_id = r.player1_id
    LEFT JOIN user_profiles p2 ON p2.user_id = r.player2_id
    WHERE r.tournament_id = ${tournamentId} AND r.status = 'confirmed'
    ORDER BY r.created_at ASC
  `

  const catMap: Record<string, Record<string, Array<{ id: string; name: string }>>> = {}

  function buildCategory(catName: string, catRegs: typeof regs) {
    const fmt = catFormats[catName]
    const ng = fmt?.numGroups ?? fallbackNumGroups
    const tpg = fmt?.teamsPerGroup ?? fallbackTPG
    catMap[catName] = {}
    for (let g = 0; g < ng; g++) {
      catMap[catName][`Grupo ${groupLetters[g]}`] = []
    }
    // Distribute confirmed regs round-robin across groups
    catRegs.forEach((reg, i) => {
      const grp = `Grupo ${groupLetters[i % ng]}`
      catMap[catName][grp].push({ id: reg.id as string, name: reg.pair_name as string })
    })
    // Fill remaining slots with placeholders
    for (let g = 0; g < ng; g++) {
      const grp = `Grupo ${groupLetters[g]}`
      const existing = catMap[catName][grp].length
      for (let s = existing + 1; s <= tpg; s++) {
        catMap[catName][grp].push({ id: `__slot__${catName}-${g}-${s}`, name: `P${s}` })
      }
    }
  }

  if (categoryNames.length > 0) {
    const regsByCat: Record<string, typeof regs> = {}
    for (const name of categoryNames) regsByCat[name] = []
    for (const r of regs) {
      const fd = (r.form_data as Record<string, unknown>) ?? {}
      const cat = (fd.category as string) || ''
      if (cat in regsByCat) regsByCat[cat].push(r)
      else if (categoryNames.length === 1) regsByCat[categoryNames[0]].push(r)
    }
    for (const [name, catRegs] of Object.entries(regsByCat)) buildCategory(name, catRegs)
  } else {
    buildCategory('', regs)
  }

  return { data: catMap }
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

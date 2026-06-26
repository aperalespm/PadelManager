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
        WHEN p1.display_name IS NOT NULL
        THEN p1.display_name || ' / ' || COALESCE(p2.display_name, r.player2_name, '?')
        ELSE COALESCE(r.player1_name, '?') || ' / ' || COALESCE(r.player2_name, '?')
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
        WHEN p1.display_name IS NOT NULL
        THEN p1.display_name || ' / ' || COALESCE(p2.display_name, r.player2_name, '?')
        ELSE COALESCE(r.player1_name, '?') || ' / ' || COALESCE(r.player2_name, '?')
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

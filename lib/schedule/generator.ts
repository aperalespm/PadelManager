import type { TournamentSchedule, ScheduleMatch, ScheduleSummary, ScheduleDistribution } from '@/lib/types/schedule'

// ── Time utils ───────────────────────────────────────────────────────────────

function toMins(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

function toTime(mins: number): string {
  const h = Math.floor(Math.max(0, mins) / 60)
  const m = Math.max(0, mins) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── Blocked intervals (pauses + lunch) ──────────────────────────────────────

interface Interval { start: number; end: number }

function buildBlocked(
  breaks: Array<{ start: string; end: string }>,
  lunch: { time: string; duration_minutes: number } | null
): Interval[] {
  const result: Interval[] = breaks.map(b => ({ start: toMins(b.start), end: toMins(b.end) }))
  if (lunch) {
    const s = toMins(lunch.time)
    result.push({ start: s, end: s + lunch.duration_minutes })
  }
  return result.sort((a, b) => a.start - b.start)
}

// Push start forward until [start, start+duration) doesn't overlap any blocked interval
function skipBlocked(start: number, duration: number, blocked: Interval[]): number {
  let cur = start
  let changed = true
  while (changed) {
    changed = false
    for (const b of blocked) {
      if (cur < b.end && cur + duration > b.start) {
        cur = b.end
        changed = true
        break
      }
    }
  }
  return cur
}

// ── Round-robin pairs ────────────────────────────────────────────────────────

function roundRobinPairs(n: number): Array<[number, number]> {
  const size = n % 2 === 0 ? n : n + 1
  const seats = Array.from({ length: size - 1 }, (_, i) => i + 1)
  const pairs: Array<[number, number]> = []

  for (let r = 0; r < size - 1; r++) {
    const rotated = r === 0 ? seats : [...seats.slice(r), ...seats.slice(0, r)]
    const opp = rotated[0]
    if (opp < n) pairs.push([0, opp])
    for (let i = 1; i < size / 2; i++) {
      const a = rotated[i]
      const b = rotated[size - 1 - i]
      if (a < n && b < n) pairs.push([a < b ? a : b, a < b ? b : a])
    }
  }

  const seen = new Set<string>()
  return pairs.filter(([a, b]) => {
    const k = `${a}-${b}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ── Knockout bracket ─────────────────────────────────────────────────────────

function knockoutRoundName(teamsLeft: number): string {
  if (teamsLeft === 2) return 'Final'
  if (teamsLeft === 4) return 'Semifinal'
  if (teamsLeft === 8) return 'Cuartos de final'
  if (teamsLeft === 16) return 'Octavos de final'
  return `Ronda ${teamsLeft}`
}

// ── Exported types ───────────────────────────────────────────────────────────

export interface OptimalFormat {
  numGroups: number
  teamsPerGroup: number
  maxPairsPerCategory: number
  totalMatches: number
  totalSlots: number
}

export interface PhaseDurations {
  groups: number
  roundOf16: number
  quarterFinal: number
  semiFinal: number
  final: number
}

function durationForRound(roundName: string, pd: PhaseDurations): number {
  if (roundName === 'Final') return pd.final
  if (roundName === 'Semifinal') return pd.semiFinal
  if (roundName === 'Cuartos de final') return pd.quarterFinal
  if (roundName === 'Octavos de final') return pd.roundOf16
  return pd.final
}

// ── Phase duration builder ────────────────────────────────────────────────────

export function buildPhaseDurations(
  phases: Array<{ name: string; maxDurationMins: number }>
): PhaseDurations {
  if (phases.length === 0) return { groups: 60, roundOf16: 60, quarterFinal: 60, semiFinal: 60, final: 60 }

  const find = (kw: string, exclude: string[] = []): number | undefined => {
    const p = phases.find(p => {
      const n = p.name.toLowerCase()
      return n.includes(kw) && !exclude.some(ex => n.includes(ex))
    })
    return p?.maxDurationMins
  }

  const defaultDur = phases[phases.length - 1]?.maxDurationMins ?? 60

  return {
    groups:       find('grupo') ?? find('fase') ?? phases[0].maxDurationMins,
    roundOf16:    find('octavo') ?? phases[0].maxDurationMins,
    quarterFinal: find('cuarto') ?? phases[0].maxDurationMins,
    semiFinal:    find('semi') ?? defaultDur,
    final:        find('final', ['semi', 'octavo', 'cuarto']) ?? defaultDur,
  }
}

// ── Legacy format finder (kept for external use) ─────────────────────────────

function matchesInGroups(g: number, t: number): number {
  return g * (t * (t - 1) / 2)
}

function matchesInKnockout(g: number, advance: number): number {
  const teams = g * advance
  return teams >= 2 ? teams - 1 : 0
}

export function findOptimalFormat(
  totalSlots: number,
  minGroups: number,
  minTeamsPerGroup: number,
  teamsAdvance: number,
  minMatchesPerTeam: number,
  numCategories: number
): OptimalFormat {
  let best: OptimalFormat = {
    numGroups: minGroups,
    teamsPerGroup: minTeamsPerGroup,
    maxPairsPerCategory: minGroups * minTeamsPerGroup,
    totalMatches: (matchesInGroups(minGroups, minTeamsPerGroup) + matchesInKnockout(minGroups, teamsAdvance)) * numCategories,
    totalSlots,
  }

  for (let g = minGroups; g <= 20; g++) {
    for (let t = minTeamsPerGroup; t <= 10; t++) {
      if (t - 1 < minMatchesPerTeam) continue
      const total = (matchesInGroups(g, t) + matchesInKnockout(g, teamsAdvance)) * numCategories
      if (total > totalSlots) break
      const pairs = g * t
      if (pairs > best.maxPairsPerCategory) {
        best = { numGroups: g, teamsPerGroup: t, maxPairsPerCategory: pairs, totalMatches: total, totalSlots }
      }
    }
  }

  return best
}

// ── Category prestige ordering ────────────────────────────────────────────────

function parsePrestige(name: string): number {
  const m = name.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : Infinity
}

function sortByPrestige<T extends { name: string }>(cats: T[]): T[] {
  return [...cats].sort((a, b) => parsePrestige(b.name) - parsePrestige(a.name))
}

// ── Knockout time calculator ──────────────────────────────────────────────────

function knockoutTimeMins(
  knockTeams: number,
  numCourts: number,
  pd: PhaseDurations,
  trans: number
): number {
  if (knockTeams < 2) return 0
  let time = 0
  let remaining = knockTeams
  while (remaining >= 2) {
    const roundName = knockoutRoundName(remaining)
    const roundDuration = durationForRound(roundName, pd)
    const matchesInRound = Math.floor(remaining / 2)
    const slots = Math.ceil(matchesInRound / numCourts)
    time += slots * (roundDuration + trans)
    remaining = Math.ceil(remaining / 2)
  }
  return time
}

// ── Power-of-2 helper ────────────────────────────────────────────────────────

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

// ── Consolation bracket time ──────────────────────────────────────────────────
// Single-elimination bracket for eliminated teams, all matches use matchDuration.

function consolationTimeMins(
  consolationTeams: number,
  numCourts: number,
  matchDuration: number,
  trans: number
): number {
  if (consolationTeams < 2) return 0
  let time = 0
  let remaining = consolationTeams
  while (remaining >= 2) {
    const slots = Math.ceil(Math.floor(remaining / 2) / numCourts)
    time += slots * (matchDuration + trans)
    remaining = Math.ceil(remaining / 2)
  }
  return time
}

// ── Per-category format optimizer ─────────────────────────────────────────────

export function findCategoryFormat(
  numCourts: number,
  availableMins: number,
  trans: number,
  pd: PhaseDurations,
  minGroups: number,
  minTeamsPerGroup: number,
  teamsAdvance: number,
  minMatchesPerTeam: number
): { numGroups: number; teamsPerGroup: number } {
  let bestG = minGroups
  let bestT = minTeamsPerGroup

  for (let g = minGroups; g <= 20; g++) {
    for (let t = minTeamsPerGroup; t <= 10; t++) {
      const groupMatchesPerTeam = t - 1
      const needsExtra = groupMatchesPerTeam < minMatchesPerTeam
      const directQualifiers = g * teamsAdvance
      const extraSpots = nextPow2(directQualifiers) - directQualifiers
      const eliminatedTeams = g * (t - teamsAdvance)

      if (needsExtra) {
        if (extraSpots > 0 && eliminatedTeams > 0) {
          // Wild card: each eliminated team gets exactly 1 extra match (either plays or gets bye to QF)
          if (groupMatchesPerTeam + 1 < minMatchesPerTeam) continue
        } else {
          // Consolation: single-elimination bracket for eliminated teams
          if (eliminatedTeams < 2) continue
          const consolDepth = Math.ceil(Math.log2(eliminatedTeams))
          if (groupMatchesPerTeam + consolDepth < minMatchesPerTeam) continue
        }
      }

      const groupMatches = matchesInGroups(g, t)
      const groupSlots = Math.ceil(groupMatches / numCourts)
      const groupTime = groupSlots * (pd.groups + trans)

      // Wild card: extra matches before KO to fill spare bracket slots
      const wcMatchCount = (needsExtra && extraSpots > 0 && eliminatedTeams > 0)
        ? Math.max(0, eliminatedTeams - extraSpots) : 0
      const wcTime = wcMatchCount > 0
        ? Math.ceil(wcMatchCount / numCourts) * (pd.groups + trans) : 0

      // KO uses full nextPow2 bracket when wild card is active
      const koTeams = (needsExtra && extraSpots > 0) ? nextPow2(directQualifiers) : directQualifiers
      const koTime = knockoutTimeMins(koTeams, numCourts, pd, trans)

      const consolTime = (needsExtra && extraSpots === 0)
        ? consolationTimeMins(eliminatedTeams, numCourts, pd.groups, trans) : 0

      if (groupTime + wcTime + koTime + consolTime > availableMins) break

      if (g * t > bestG * bestT) {
        bestG = g
        bestT = t
      }
    }
  }

  return { numGroups: bestG, teamsPerGroup: bestT }
}

// ── Public config / result types ─────────────────────────────────────────────

export interface GeneratorConfig {
  courts: Array<{
    name: string
    courtNumber: number
    breaks: Array<{ start: string; end: string }>
  }>
  schedule: {
    startTime: string
    endTime: string
    transitionMins: number
    lunchBreak: { time: string; duration_minutes: number } | null
  }
  categories: Array<{ id: string; name: string }>
  phases: Array<{ name: string; maxDurationMins: number }>
  format: {
    minGroups: number
    minTeamsPerGroup: number
    teamsAdvancePerGroup: number
    minMatchesPerTeam: number
  }
  phaseDurations?: PhaseDurations
  registeredPairs?: Array<{ category: string; pairs: string[] }>
  distribution?: ScheduleDistribution
}

export interface GeneratorResult {
  schedule: TournamentSchedule
  optimalFormat: OptimalFormat
  warnings: string[]
}

// ── Court state ───────────────────────────────────────────────────────────────

interface CourtState {
  name: string
  courtNumber: number
  cursor: number
  blocked: Interval[]
}

// ── Per-category scheduling helpers ──────────────────────────────────────────

function _schedGroups(
  catId: string,
  catName: string,
  catCourts: CourtState[],
  numGroups: number,
  teamsPerGroup: number,
  registeredPairs: GeneratorConfig['registeredPairs'],
  pd: PhaseDurations,
  trans: number,
  endMins: number,
  out: ScheduleMatch[],
  warnings: string[]
): void {
  const reg = registeredPairs?.find(r => r.category === catName || r.category === catId)
  const needed = numGroups * teamsPerGroup
  const pairList = reg ? [...reg.pairs.slice(0, needed)] : []
  while (pairList.length < needed) pairList.push(`P${pairList.length + 1}`)

  for (let g = 0; g < numGroups; g++) {
    const gl = String.fromCharCode(65 + g)
    const lbcCourts = [...catCourts].sort((a, b) => a.cursor - b.cursor)
    const groupCourt = lbcCourts[g % lbcCourts.length]
    const slot = pairList.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup)
    const rrPairs = roundRobinPairs(slot.length)

    for (let mi = 0; mi < rrPairs.length; mi++) {
      const [i, j] = rrPairs[mi]
      const p1 = slot[i] ?? `P${i + 1}`
      const p2 = slot[j] ?? `P${j + 1}`
      const start = skipBlocked(groupCourt.cursor, pd.groups, groupCourt.blocked)
      if (start + pd.groups > endMins) {
        warnings.push(`Sin tiempo para grupo ${gl} de ${catName}`)
        break
      }
      out.push({
        id: `${catId}_G${gl}_m${mi + 1}`,
        courtNumber: groupCourt.courtNumber,
        courtName: groupCourt.name,
        startTime: toTime(start),
        endTime: toTime(start + pd.groups),
        categoryId: catId,
        categoryName: catName,
        groupId: `${catId}_G${gl}`,
        phase: `Grupo ${gl}`,
        pair1: p1,
        pair2: p2,
        matchLabel: `${catName} · Grupo ${gl}`,
        status: 'scheduled',
      })
      groupCourt.cursor = start + pd.groups + trans
    }
  }
}

function _schedGroupsAll(
  cats: Array<{ id: string; name: string }>,
  catFmts: Map<string, { numGroups: number; teamsPerGroup: number }>,
  allCourts: CourtState[],
  defaultFmt: { numGroups: number; teamsPerGroup: number },
  registeredPairs: GeneratorConfig['registeredPairs'],
  pd: PhaseDurations,
  trans: number,
  endMins: number,
  out: ScheduleMatch[],
  warnings: string[]
): void {
  type GroupDesc = { catId: string; catName: string; gl: string; pairs: string[]; rrPairs: [number, number][] }
  const allGroups: GroupDesc[] = []
  for (const cat of cats) {
    const fmt = catFmts.get(cat.id) ?? defaultFmt
    const reg = registeredPairs?.find(r => r.category === cat.name || r.category === cat.id)
    const needed = fmt.numGroups * fmt.teamsPerGroup
    const pairList = reg ? [...reg.pairs.slice(0, needed)] : []
    while (pairList.length < needed) pairList.push(`P${pairList.length + 1}`)
    for (let g = 0; g < fmt.numGroups; g++) {
      const gl = String.fromCharCode(65 + g)
      const slot = pairList.slice(g * fmt.teamsPerGroup, (g + 1) * fmt.teamsPerGroup)
      allGroups.push({ catId: cat.id, catName: cat.name, gl, pairs: slot, rrPairs: roundRobinPairs(slot.length) })
    }
  }
  // Schedule round by round: all groups' match-0, then match-1, etc.
  // Each individual match uses true LBC so courts stay balanced (±1 match max).
  const maxRounds = allGroups.reduce((m, g) => Math.max(m, g.rrPairs.length), 0)
  for (let mi = 0; mi < maxRounds; mi++) {
    for (const grp of allGroups) {
      if (mi >= grp.rrPairs.length) continue
      const court = [...allCourts].sort((a, b) => a.cursor - b.cursor)[0]
      const [i, j] = grp.rrPairs[mi]
      const p1 = grp.pairs[i] ?? `P${i + 1}`
      const p2 = grp.pairs[j] ?? `P${j + 1}`
      const start = skipBlocked(court.cursor, pd.groups, court.blocked)
      if (start + pd.groups > endMins) {
        warnings.push(`Sin tiempo para grupo ${grp.gl} de ${grp.catName}`)
        continue
      }
      out.push({
        id: `${grp.catId}_G${grp.gl}_m${mi + 1}`,
        courtNumber: court.courtNumber,
        courtName: court.name,
        startTime: toTime(start),
        endTime: toTime(start + pd.groups),
        categoryId: grp.catId,
        categoryName: grp.catName,
        groupId: `${grp.catId}_G${grp.gl}`,
        phase: `Grupo ${grp.gl}`,
        pair1: p1,
        pair2: p2,
        matchLabel: `${grp.catName} · Grupo ${grp.gl}`,
        status: 'scheduled',
      })
      court.cursor = start + pd.groups + trans
    }
  }
}

function _barrierCat(catCourts: CourtState[]): void {
  const t = Math.max(...catCourts.map(c => c.cursor))
  catCourts.forEach(c => { c.cursor = t })
}

function _schedConsolation(
  catId: string,
  catName: string,
  catCourts: CourtState[],
  consolationTeams: number,
  matchDuration: number,
  trans: number,
  endMins: number,
  out: ScheduleMatch[],
  warnings: string[]
): void {
  if (consolationTeams < 2) return
  let remaining = consolationTeams
  let roundIdx = 0

  while (remaining >= 2) {
    const phaseName = remaining === 2 ? 'Consolación Final' : `Consolación SF`
    const numMatches = Math.floor(remaining / 2)

    for (let mi = 0; mi < numMatches; mi++) {
      const courtForMatch = catCourts.reduce((best, cs) => cs.cursor < best.cursor ? cs : best)
      const start = skipBlocked(courtForMatch.cursor, matchDuration, courtForMatch.blocked)
      if (start + matchDuration > endMins) {
        warnings.push(`Sin tiempo para ${phaseName} de ${catName}`)
        break
      }
      const p1Label = roundIdx === 0 ? `Elim. Gr.${String.fromCharCode(65 + mi * 2)}` : `Gan. C${mi * 2 + 1}`
      const p2Label = roundIdx === 0 ? `Elim. Gr.${String.fromCharCode(65 + mi * 2 + 1)}` : `Gan. C${mi * 2 + 2}`

      out.push({
        id: `${catId}_CON_r${roundIdx}_m${mi + 1}`,
        courtNumber: courtForMatch.courtNumber,
        courtName: courtForMatch.name,
        startTime: toTime(start),
        endTime: toTime(start + matchDuration),
        categoryId: catId,
        categoryName: catName,
        groupId: null,
        phase: phaseName,
        pair1: p1Label,
        pair2: p2Label,
        matchLabel: `${catName} · ${phaseName}`,
        status: 'scheduled',
      })
      courtForMatch.cursor = start + matchDuration + trans
    }

    const roundEnd = Math.max(...catCourts.map(c => c.cursor))
    catCourts.forEach(c => { c.cursor = roundEnd })
    remaining = Math.ceil(remaining / 2)
    roundIdx++
  }
}

function _schedWildCard(
  catId: string,
  catName: string,
  catCourts: CourtState[],
  eliminatedTeams: number,
  extraSpots: number,
  matchDuration: number,
  trans: number,
  endMins: number,
  out: ScheduleMatch[],
  warnings: string[]
): void {
  const wcMatchCount = Math.max(0, eliminatedTeams - extraSpots)
  if (wcMatchCount === 0) return

  const phaseName = 'Repechaje'
  for (let mi = 0; mi < wcMatchCount; mi++) {
    const courtForMatch = catCourts.reduce((best, cs) => cs.cursor < best.cursor ? cs : best)
    const start = skipBlocked(courtForMatch.cursor, matchDuration, courtForMatch.blocked)
    if (start + matchDuration > endMins) {
      warnings.push(`Sin tiempo para ${phaseName} de ${catName}`)
      break
    }
    // The two lowest-ranked 3rd-placers play; best 3rd gets a bye
    const byeRank = extraSpots  // teams getting byes (best-ranked)
    const p1Label = `3° Gr.${String.fromCharCode(65 + byeRank + mi * 2)}`
    const p2Label = `3° Gr.${String.fromCharCode(65 + byeRank + mi * 2 + 1)}`

    out.push({
      id: `${catId}_WC_m${mi + 1}`,
      courtNumber: courtForMatch.courtNumber,
      courtName: courtForMatch.name,
      startTime: toTime(start),
      endTime: toTime(start + matchDuration),
      categoryId: catId,
      categoryName: catName,
      groupId: null,
      phase: phaseName,
      pair1: p1Label,
      pair2: p2Label,
      matchLabel: `${catName} · ${phaseName}`,
      status: 'scheduled',
    })
    courtForMatch.cursor = start + matchDuration + trans
  }

  const roundEnd = Math.max(...catCourts.map(c => c.cursor))
  catCourts.forEach(c => { c.cursor = roundEnd })
}

function _schedKO(
  catId: string,
  catName: string,
  catCourts: CourtState[],
  numGroups: number,
  teamsAdvance: number,
  pd: PhaseDurations,
  trans: number,
  endMins: number,
  out: ScheduleMatch[],
  warnings: string[],
  knockTeamsOverride?: number
): void {
  const knockTeams = knockTeamsOverride ?? (numGroups * teamsAdvance)
  if (knockTeams < 2) return

  let remaining = knockTeams
  let roundIdx = 0

  while (remaining >= 2) {
    const roundName = knockoutRoundName(remaining)
    const roundDuration = durationForRound(roundName, pd)
    const numMatches = Math.floor(remaining / 2)

    for (let mi = 0; mi < numMatches; mi++) {
      const courtForMatch = catCourts.reduce((best, cs) => cs.cursor < best.cursor ? cs : best)
      const start = skipBlocked(courtForMatch.cursor, roundDuration, courtForMatch.blocked)
      if (start + roundDuration > endMins) {
        warnings.push(`Sin tiempo para ${roundName} de ${catName}`)
        break
      }

      const p1Label = roundIdx === 0
        ? `1° Gr.${String.fromCharCode(65 + mi)}`
        : `Gan. P${mi * 2 + 1}`
      const p2Label = roundIdx === 0
        ? `2° Gr.${String.fromCharCode(65 + (mi + 1) % numGroups)}`
        : `Gan. P${mi * 2 + 2}`

      out.push({
        id: `${catId}_KO_r${roundIdx}_m${mi + 1}`,
        courtNumber: courtForMatch.courtNumber,
        courtName: courtForMatch.name,
        startTime: toTime(start),
        endTime: toTime(start + roundDuration),
        categoryId: catId,
        categoryName: catName,
        groupId: null,
        phase: roundName,
        pair1: p1Label,
        pair2: p2Label,
        matchLabel: `${catName} · ${roundName}`,
        status: 'scheduled',
      })
      courtForMatch.cursor = start + roundDuration + trans
    }

    // Barrier per KO round
    const roundEnd = Math.max(...catCourts.map(c => c.cursor))
    catCourts.forEach(c => { c.cursor = roundEnd })

    remaining = Math.ceil(remaining / 2)
    roundIdx++
  }
}

// ── Court count per category ──────────────────────────────────────────────────
// Returns how many physical courts each category gets within a bin.

function courtCountsForBin(numCourts: number, cats: Array<{ id: string }>): Map<string, number> {
  if (cats.length === 0) return new Map()
  if (cats.length <= numCourts) {
    const base  = Math.floor(numCourts / cats.length)
    const extra = numCourts % cats.length
    return new Map(cats.map((c, i) => [c.id, base + (i < extra ? 1 : 0)]))
  }
  // More cats than courts — all share, each effectively gets 1
  return new Map(cats.map(c => [c.id, 1]))
}

// ── Assign courts within a bin ────────────────────────────────────────────────
// If more cats than courts, wrap around so cats share courts (sequential effect).

function assignCourtsInBin(
  binCats: Array<{ id: string; name: string }>,
  numCourts: number
): Map<string, number[]> {
  const map = new Map<string, number[]>()
  if (binCats.length === 0) return map
  if (binCats.length <= numCourts) {
    const base  = Math.floor(numCourts / binCats.length)
    const extra = numCourts % binCats.length
    let ci = 0
    for (let i = 0; i < binCats.length; i++) {
      const count = base + (i < extra ? 1 : 0)
      map.set(binCats[i].id, Array.from({ length: count }, (_, j) => ci + j))
      ci += count
    }
  } else {
    // Each cat gets 1 court (shared with other cats via modulo)
    for (let i = 0; i < binCats.length; i++) {
      map.set(binCats[i].id, [i % numCourts])
    }
  }
  return map
}

// ── Main scheduler ────────────────────────────────────────────────────────────

export function generateSchedule(config: GeneratorConfig): GeneratorResult {
  const warnings: string[] = []
  const { courts, schedule: sched, categories, format, registeredPairs, distribution } = config

  if (courts.length === 0) {
    warnings.push('No hay pistas configuradas.')
    return emptyResult(sched.endTime, format, warnings)
  }
  if (categories.length === 0) {
    warnings.push('No hay categorías configuradas.')
    return emptyResult(sched.endTime, format, warnings)
  }

  const startMins     = toMins(sched.startTime)
  const endMins       = toMins(sched.endTime)
  const trans         = sched.transitionMins
  const lunchMins     = sched.lunchBreak?.duration_minutes ?? 0
  const availableMins = endMins - startMins - lunchMins

  const pd: PhaseDurations = config.phaseDurations ?? buildPhaseDurations(config.phases)
  const sortedCats = sortByPrestige(categories)
  const numCourts  = courts.length

  // ── Build bin plan ────────────────────────────────────────────────────────
  // Each bin runs as a sequential time slice; categories within a bin run in
  // parallel on their assigned courts.

  interface BinPlan {
    cats: Array<{ id: string; name: string }>
    catCourts: Map<string, number[]>
    catFmts: Map<string, { numGroups: number; teamsPerGroup: number }>
  }

  const bins: BinPlan[] = []
  const hasBins = distribution && distribution.bins.length > 1
  const numBins = hasBins ? distribution.bins.length : 1
  const mode    = hasBins ? (distribution.mode ?? 'complete') : 'complete'
  const timeBudgetPerBin = availableMins / numBins

  if (!hasBins) {
    // Single bin — all cats, use full available time
    const catCourts = assignCourtsInBin(sortedCats, numCourts)
    const courtCounts = courtCountsForBin(numCourts, sortedCats)
    const catFmts = new Map<string, { numGroups: number; teamsPerGroup: number }>()
    for (const cat of sortedCats) {
      const cfc = Math.max(1, courtCounts.get(cat.id) ?? 1)
      catFmts.set(cat.id, findCategoryFormat(
        cfc, availableMins, trans, pd,
        format.minGroups, format.minTeamsPerGroup, format.teamsAdvancePerGroup, format.minMatchesPerTeam
      ))
    }
    bins.push({ cats: sortedCats, catCourts, catFmts })
  } else {
    // User-defined bins
    const allAssigned = new Set<string>()
    for (const binDef of distribution.bins) {
      const binCats = binDef.categoryIds
        .map(id => sortedCats.find(c => c.id === id))
        .filter((c): c is typeof sortedCats[0] => !!c)
      binCats.forEach(c => allAssigned.add(c.id))
      if (binCats.length === 0) continue

      const catCourts = assignCourtsInBin(binCats, numCourts)
      const courtCounts = courtCountsForBin(numCourts, binCats)
      const catFmts = new Map<string, { numGroups: number; teamsPerGroup: number }>()
      for (const cat of binCats) {
        const cfc = Math.max(1, courtCounts.get(cat.id) ?? 1)
        catFmts.set(cat.id, findCategoryFormat(
          cfc, timeBudgetPerBin, trans, pd,
          format.minGroups, format.minTeamsPerGroup, format.teamsAdvancePerGroup, format.minMatchesPerTeam
        ))
      }
      bins.push({ cats: binCats, catCourts, catFmts })
    }

    // Orphan categories (not assigned to any bin) go to first bin
    const orphans = sortedCats.filter(c => !allAssigned.has(c.id))
    if (orphans.length > 0 && bins.length > 0) {
      const b = bins[0]
      b.cats = [...b.cats, ...orphans]
      b.catCourts = assignCourtsInBin(b.cats, numCourts)
      const newCourtCounts = courtCountsForBin(numCourts, b.cats)
      for (const cat of b.cats) {
        const cfc = Math.max(1, newCourtCounts.get(cat.id) ?? 1)
        b.catFmts.set(cat.id, findCategoryFormat(
          cfc, timeBudgetPerBin, trans, pd,
          format.minGroups, format.minTeamsPerGroup, format.teamsAdvancePerGroup, format.minMatchesPerTeam
        ))
      }
    }
  }

  if (bins.length === 0) {
    warnings.push('No hay categorías configuradas.')
    return emptyResult(sched.endTime, format, warnings)
  }

  // ── Court states ──────────────────────────────────────────────────────────
  const courtStates: CourtState[] = courts.map(c => ({
    name: c.name,
    courtNumber: c.courtNumber,
    cursor: startMins,
    blocked: buildBlocked(c.breaks, sched.lunchBreak),
  }))

  const scheduledMatches: ScheduleMatch[] = []

  // ── Schedule ──────────────────────────────────────────────────────────────
  // Shared KO dispatch — used by both modes
  function schedKOForCat(cat: typeof bins[0]['cats'][0], catCourts: CourtState[], catFmt: { numGroups: number; teamsPerGroup: number }): void {
    const needsExtra = catFmt.teamsPerGroup - 1 < format.minMatchesPerTeam
    const directQ = catFmt.numGroups * format.teamsAdvancePerGroup
    const extraSpots = nextPow2(directQ) - directQ
    const elimTeams = catFmt.numGroups * (catFmt.teamsPerGroup - format.teamsAdvancePerGroup)
    if (needsExtra && extraSpots > 0 && elimTeams > 0) {
      _schedWildCard(cat.id, cat.name, catCourts, elimTeams, extraSpots, pd.groups, trans, endMins, scheduledMatches, warnings)
    }
    const koTeams = (needsExtra && extraSpots > 0) ? nextPow2(directQ) : undefined
    _schedKO(cat.id, cat.name, catCourts, catFmt.numGroups, format.teamsAdvancePerGroup, pd, trans, endMins, scheduledMatches, warnings, koTeams)
    if (needsExtra && extraSpots === 0 && elimTeams >= 2) {
      _schedConsolation(cat.id, cat.name, catCourts, elimTeams, pd.groups, trans, endMins, scheduledMatches, warnings)
    }
  }

  if (mode === 'complete') {
    // Each bin: shared groups pass → parallel dedicated KO pass
    let cursor = startMins
    for (const bin of bins) {
      for (const cs of courtStates) cs.cursor = cursor

      // Groups: all cats share all courts via per-match LBC (balanced, no gaps)
      const defaultFmt = { numGroups: format.minGroups, teamsPerGroup: format.minTeamsPerGroup }
      _schedGroupsAll(bin.cats, bin.catFmts, courtStates, defaultFmt, registeredPairs, pd, trans, endMins, scheduledMatches, warnings)
      _barrierCat(courtStates)
      const afterGroups = Math.max(...courtStates.map(c => c.cursor))

      // KO: dedicated court subsets, each cat starts from afterGroups
      for (const cat of bin.cats) {
        const indices = bin.catCourts.get(cat.id) ?? [0]
        const catCourts = indices.map(i => courtStates[i])
        catCourts.forEach(c => { c.cursor = Math.max(c.cursor, afterGroups) })
        _barrierCat(catCourts)
        const catFmt = bin.catFmts.get(cat.id) ?? { numGroups: format.minGroups, teamsPerGroup: format.minTeamsPerGroup }
        schedKOForCat(cat, catCourts, catFmt)
      }

      cursor = Math.max(...courtStates.map(c => c.cursor))
    }
  } else {
    // by_phase: shared groups for all bins, then parallel dedicated KO for all bins
    let cursor = startMins

    // Groups pass: all cats in each bin share all courts
    for (const bin of bins) {
      for (const cs of courtStates) cs.cursor = cursor

      const defaultFmtByPhase = { numGroups: format.minGroups, teamsPerGroup: format.minTeamsPerGroup }
      _schedGroupsAll(bin.cats, bin.catFmts, courtStates, defaultFmtByPhase, registeredPairs, pd, trans, endMins, scheduledMatches, warnings)
      _barrierCat(courtStates)

      cursor = Math.max(...courtStates.map(c => c.cursor))
    }

    // KO pass — starts after all groups complete; dedicated courts per cat
    for (const bin of bins) {
      for (const cs of courtStates) cs.cursor = cursor

      for (const cat of bin.cats) {
        const indices = bin.catCourts.get(cat.id) ?? [0]
        const catCourts = indices.map(i => courtStates[i])
        const catFmt = bin.catFmts.get(cat.id) ?? { numGroups: format.minGroups, teamsPerGroup: format.minTeamsPerGroup }
        schedKOForCat(cat, catCourts, catFmt)
      }

      cursor = Math.max(...courtStates.map(c => c.cursor))
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const matchesPerCategory: Record<string, number> = {}
  const finalTimes: Record<string, string> = {}

  for (const cat of categories) {
    const catMatches = scheduledMatches.filter(m => m.categoryId === cat.id)
    matchesPerCategory[cat.name] = catMatches.length
    if (catMatches.length > 0) {
      const last = catMatches.reduce((l, m) => toMins(m.endTime) > toMins(l.endTime) ? m : l)
      finalTimes[cat.name] = last.endTime
    }
  }

  const estimatedEndTime = scheduledMatches.length > 0
    ? scheduledMatches.reduce((l, m) => toMins(m.endTime) > toMins(l.endTime) ? m : l).endTime
    : sched.endTime

  const courtsUsed = new Set(scheduledMatches.map(m => m.courtNumber)).size

  const firstBin = bins[0]
  const firstCatFmt = firstBin && firstBin.catFmts.size > 0
    ? Array.from(firstBin.catFmts.values())[0]
    : { numGroups: format.minGroups, teamsPerGroup: format.minTeamsPerGroup }

  const totalCapacity = bins.reduce((sum, bin) => {
    let binCap = 0
    for (const fmt of bin.catFmts.values()) binCap += fmt.numGroups * fmt.teamsPerGroup
    return sum + binCap
  }, 0)

  const summary: ScheduleSummary = {
    totalMatches: scheduledMatches.length,
    estimatedEndTime,
    courtsUsed,
    matchesPerCategory,
    finalTimes,
    warnings,
  }

  const explanation = [
    `${firstCatFmt.numGroups} grupos de ${firstCatFmt.teamsPerGroup} parejas (primera categoría).`,
    `Capacidad total: ${totalCapacity} parejas.`,
    `${scheduledMatches.length} partidos · fin estimado ${estimatedEndTime}.`,
  ].join(' ')

  return {
    schedule: { matches: scheduledMatches, summary, rawExplanation: explanation },
    optimalFormat: {
      numGroups: firstCatFmt.numGroups,
      teamsPerGroup: firstCatFmt.teamsPerGroup,
      maxPairsPerCategory: firstCatFmt.numGroups * firstCatFmt.teamsPerGroup,
      totalMatches: scheduledMatches.length,
      totalSlots: 0,
    },
    warnings,
  }
}

// ── Shared-groups format optimizer ────────────────────────────────────────────
// Models the scheduler where all categories share the court pool during groups,
// then run KO in parallel on dedicated subsets. Adding 1 court reduces group
// slots for ALL categories (ceil(totalGroupMatches/numCourts) decreases).

function findSharedGroupsFormat(
  numCats: number,
  numCourts: number,
  availableMins: number,
  trans: number,
  pd: PhaseDurations,
  minGroups: number,
  minTeamsPerGroup: number,
  teamsAdvance: number,
  minMatchesPerTeam: number
): { numGroups: number; teamsPerGroup: number } {
  const koCourtCount = Math.max(1, Math.floor(numCourts / numCats))
  let bestG = minGroups
  let bestT = minTeamsPerGroup

  for (let g = minGroups; g <= 20; g++) {
    for (let t = minTeamsPerGroup; t <= 10; t++) {
      const groupMatchesPerTeam = t - 1
      const needsExtra = groupMatchesPerTeam < minMatchesPerTeam
      const directQualifiers = g * teamsAdvance
      const extraSpots = nextPow2(directQualifiers) - directQualifiers
      const eliminatedTeams = g * (t - teamsAdvance)

      if (needsExtra) {
        if (extraSpots > 0 && eliminatedTeams > 0) {
          if (groupMatchesPerTeam + 1 < minMatchesPerTeam) continue
        } else {
          if (eliminatedTeams < 2) continue
          const consolDepth = Math.ceil(Math.log2(eliminatedTeams))
          if (groupMatchesPerTeam + consolDepth < minMatchesPerTeam) continue
        }
      }

      // Groups: ALL categories share ALL courts
      const totalGroupMatches = numCats * matchesInGroups(g, t)
      const groupSlots = Math.ceil(totalGroupMatches / numCourts)
      const groupTime  = groupSlots * (pd.groups + trans)

      // Wild card: also shared (runs after groups, before KO)
      const wcMatchCount = (needsExtra && extraSpots > 0 && eliminatedTeams > 0)
        ? Math.max(0, eliminatedTeams - extraSpots) : 0
      const totalWcMatches = wcMatchCount * numCats
      const wcTime = totalWcMatches > 0
        ? Math.ceil(totalWcMatches / numCourts) * (pd.groups + trans) : 0

      // KO: parallel, each cat on koCourtCount dedicated courts
      const koTeams = (needsExtra && extraSpots > 0) ? nextPow2(directQualifiers) : directQualifiers
      const koTime  = knockoutTimeMins(koTeams, koCourtCount, pd, trans)

      // Consolation: parallel
      const consolTime = (needsExtra && extraSpots === 0)
        ? consolationTimeMins(eliminatedTeams, koCourtCount, pd.groups, trans) : 0

      if (groupTime + wcTime + koTime + consolTime > availableMins) break

      if (g * t > bestG * bestT) { bestG = g; bestT = t }
    }
  }
  return { numGroups: bestG, teamsPerGroup: bestT }
}

// ── Compute optimal formats from venue_details ────────────────────────────────
// Shared utility used by cuadro page and bracket actions to stay in sync with
// the schedule optimizer without re-running a full schedule generation.

export function computeOptimalFormats(
  vd: Record<string, unknown>
): Record<string, { numGroups: number; teamsPerGroup: number }> {
  const sched = (vd.schedule as Record<string, unknown>) ?? {}
  const startMins = toMins(String(sched.start_time ?? '09:00'))
  const endMins   = toMins(String(sched.end_time   ?? '21:00'))
  const trans     = parseInt(String(sched.transition_minutes ?? '0')) || 0
  const lunch     = sched.lunch_break as { duration_minutes?: number } | null | undefined
  const avail     = endMins - startMins - (lunch?.duration_minutes ?? 0)
  if (avail <= 0) return {}

  const rawPhases = (vd.phases as Array<{ name: string; match_config?: { time_limit_minutes?: number } }>) ?? []
  const pd = ((sched.phase_durations ?? vd.phase_durations) as PhaseDurations | undefined)
    ?? buildPhaseDurations(rawPhases.map(p => ({
      name: p.name,
      maxDurationMins: (p.match_config?.time_limit_minutes as number) ?? 60,
    })))

  const rawCats = (vd.categories as Array<{ name: string; genders?: string[] }>) ?? []
  const expanded: string[] = []
  for (const cat of rawCats) {
    if (!cat.name?.trim()) continue
    if (!cat.genders?.length) {
      expanded.push(cat.name)
    } else {
      for (const g of cat.genders) {
        const suffix = g === 'M' ? ' Masculino' : g === 'F' ? ' Femenino' : ' Mixto'
        expanded.push(cat.name + suffix)
      }
    }
  }
  if (expanded.length === 0) return {}

  const numCourts  = Math.max(1, ((vd.courts as unknown[]) ?? []).length)
  const numCats    = expanded.length
  const minGroups  = Math.max(1, parseInt(String(vd.num_groups   ?? '2')) || 2)
  const minTPG     = Math.max(2, parseInt(String(vd.teams_per_group ?? '3')) || 3)
  const teamsAdv   = Math.max(1, parseInt(String(vd.teams_advance_per_group ?? '2')) || 2)
  const minMatches = Math.max(1, parseInt(String(vd.min_matches_per_team ?? '2')) || 2)

  // Shared-groups model: all categories share the court pool during groups, so
  // every extra court reduces group slots for ALL categories equally.
  const sharedFmt = findSharedGroupsFormat(numCats, numCourts, avail, trans, pd, minGroups, minTPG, teamsAdv, minMatches)

  // Sort descending by prestige so order matches the scheduler (sortByPrestige)
  const sortedExpanded = [...expanded].sort((a, b) => parsePrestige(b) - parsePrestige(a))

  const result: Record<string, { numGroups: number; teamsPerGroup: number }> = {}
  sortedExpanded.forEach(name => { result[name] = sharedFmt })
  return result
}

function emptyResult(endTime: string, format: GeneratorConfig['format'], warnings: string[]): GeneratorResult {
  return {
    schedule: {
      matches: [],
      summary: { totalMatches: 0, estimatedEndTime: endTime, courtsUsed: 0, matchesPerCategory: {}, finalTimes: {}, warnings },
      rawExplanation: '',
    },
    optimalFormat: {
      numGroups: format.minGroups,
      teamsPerGroup: format.minTeamsPerGroup,
      maxPairsPerCategory: 0,
      totalMatches: 0,
      totalSlots: 0,
    },
    warnings,
  }
}

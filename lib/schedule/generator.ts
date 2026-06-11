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

// ── Per-category format optimizer ─────────────────────────────────────────────

function findCategoryFormat(
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

  // Start from the minimum feasible t, not minTeamsPerGroup — allows g=4,t=3 > g=2,t=4 even when minTeamsPerGroup=4
  const tFloor = Math.max(2, minMatchesPerTeam + 1)

  for (let g = minGroups; g <= 20; g++) {
    for (let t = tFloor; t <= 10; t++) {
      if (t - 1 < minMatchesPerTeam) continue

      const groupMatches = matchesInGroups(g, t)
      const groupSlots = Math.ceil(groupMatches / numCourts)
      const groupTime = groupSlots * (pd.groups + trans)

      const knockTeams = g * teamsAdvance
      const koTime = knockoutTimeMins(knockTeams, numCourts, pd, trans)

      if (groupTime + koTime > availableMins) break

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
    const groupCourt = catCourts[g % catCourts.length]
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

function _barrierCat(catCourts: CourtState[]): void {
  const t = Math.max(...catCourts.map(c => c.cursor))
  catCourts.forEach(c => { c.cursor = t })
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
  warnings: string[]
): void {
  const knockTeams = numGroups * teamsAdvance
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
    numGroups: number
    teamsPerGroup: number
  }

  const bins: BinPlan[] = []
  const hasBins = distribution && distribution.bins.length > 1
  const numBins = hasBins ? distribution.bins.length : 1
  const mode    = hasBins ? (distribution.mode ?? 'complete') : 'complete'
  const timeBudgetPerBin = availableMins / numBins

  if (!hasBins) {
    // Single bin — all cats, use full available time
    const courtsForFormat = Math.max(1, Math.floor(numCourts / Math.max(1, sortedCats.length)))
    const fmt = findCategoryFormat(
      courtsForFormat, availableMins, trans, pd,
      format.minGroups, format.minTeamsPerGroup, format.teamsAdvancePerGroup, format.minMatchesPerTeam
    )
    bins.push({
      cats: sortedCats,
      catCourts: assignCourtsInBin(sortedCats, numCourts),
      numGroups: fmt.numGroups,
      teamsPerGroup: fmt.teamsPerGroup,
    })
  } else {
    // User-defined bins
    const allAssigned = new Set<string>()
    for (const binDef of distribution.bins) {
      const binCats = binDef.categoryIds
        .map(id => sortedCats.find(c => c.id === id))
        .filter((c): c is typeof sortedCats[0] => !!c)
      binCats.forEach(c => allAssigned.add(c.id))
      if (binCats.length === 0) continue

      const courtsForFormat = Math.max(1, Math.floor(numCourts / binCats.length))
      const fmt = findCategoryFormat(
        courtsForFormat, timeBudgetPerBin, trans, pd,
        format.minGroups, format.minTeamsPerGroup, format.teamsAdvancePerGroup, format.minMatchesPerTeam
      )
      bins.push({
        cats: binCats,
        catCourts: assignCourtsInBin(binCats, numCourts),
        numGroups: fmt.numGroups,
        teamsPerGroup: fmt.teamsPerGroup,
      })
    }

    // Orphan categories (not assigned to any bin) go to first bin
    const orphans = sortedCats.filter(c => !allAssigned.has(c.id))
    if (orphans.length > 0 && bins.length > 0) {
      const b = bins[0]
      b.cats = [...b.cats, ...orphans]
      b.catCourts = assignCourtsInBin(b.cats, numCourts)
      const courtsForFormat = Math.max(1, Math.floor(numCourts / b.cats.length))
      const fmt = findCategoryFormat(
        courtsForFormat, timeBudgetPerBin, trans, pd,
        format.minGroups, format.minTeamsPerGroup, format.teamsAdvancePerGroup, format.minMatchesPerTeam
      )
      b.numGroups = fmt.numGroups
      b.teamsPerGroup = fmt.teamsPerGroup
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
  if (mode === 'complete') {
    // Each bin: groups + KO, then next bin starts
    let cursor = startMins
    for (const bin of bins) {
      for (const cs of courtStates) cs.cursor = cursor

      for (const cat of bin.cats) {
        const indices = bin.catCourts.get(cat.id) ?? [0]
        const catCourts = indices.map(i => courtStates[i])
        _schedGroups(cat.id, cat.name, catCourts, bin.numGroups, bin.teamsPerGroup, registeredPairs, pd, trans, endMins, scheduledMatches, warnings)
        _barrierCat(catCourts)
        _schedKO(cat.id, cat.name, catCourts, bin.numGroups, format.teamsAdvancePerGroup, pd, trans, endMins, scheduledMatches, warnings)
      }

      cursor = Math.max(...courtStates.map(c => c.cursor))
    }
  } else {
    // by_phase: all bins' groups sequentially, then all bins' KO sequentially
    let cursor = startMins

    // Groups pass
    for (const bin of bins) {
      for (const cs of courtStates) cs.cursor = cursor

      for (const cat of bin.cats) {
        const indices = bin.catCourts.get(cat.id) ?? [0]
        const catCourts = indices.map(i => courtStates[i])
        _schedGroups(cat.id, cat.name, catCourts, bin.numGroups, bin.teamsPerGroup, registeredPairs, pd, trans, endMins, scheduledMatches, warnings)
        _barrierCat(catCourts)
      }

      cursor = Math.max(...courtStates.map(c => c.cursor))
    }

    // KO pass — starts after all groups complete
    for (const bin of bins) {
      for (const cs of courtStates) cs.cursor = cursor

      for (const cat of bin.cats) {
        const indices = bin.catCourts.get(cat.id) ?? [0]
        const catCourts = indices.map(i => courtStates[i])
        _schedKO(cat.id, cat.name, catCourts, bin.numGroups, format.teamsAdvancePerGroup, pd, trans, endMins, scheduledMatches, warnings)
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
  const firstFmt = firstBin
    ? { numGroups: firstBin.numGroups, teamsPerGroup: firstBin.teamsPerGroup }
    : { numGroups: format.minGroups, teamsPerGroup: format.minTeamsPerGroup }

  const summary: ScheduleSummary = {
    totalMatches: scheduledMatches.length,
    estimatedEndTime,
    courtsUsed,
    matchesPerCategory,
    finalTimes,
    warnings,
  }

  const explanation = [
    `${firstFmt.numGroups} grupos de ${firstFmt.teamsPerGroup} parejas por categoría.`,
    `Capacidad: ${firstFmt.numGroups * firstFmt.teamsPerGroup} parejas/categoría.`,
    `${scheduledMatches.length} partidos · fin estimado ${estimatedEndTime}.`,
  ].join(' ')

  return {
    schedule: { matches: scheduledMatches, summary, rawExplanation: explanation },
    optimalFormat: {
      numGroups: firstFmt.numGroups,
      teamsPerGroup: firstFmt.teamsPerGroup,
      maxPairsPerCategory: firstFmt.numGroups * firstFmt.teamsPerGroup,
      totalMatches: scheduledMatches.length,
      totalSlots: 0,
    },
    warnings,
  }
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

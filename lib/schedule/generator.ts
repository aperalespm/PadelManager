import type { TournamentSchedule, ScheduleMatch, ScheduleSummary } from '@/lib/types/schedule'

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
// Derives PhaseDurations from the named phases array stored in venue_details.
// Matches by Spanish keyword so order in the array doesn't matter.

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
// "4ª" → 4, "1ª Mixto" → 1, "Abierta" → null
// Lower prestige (higher number, or no number) comes first (gets earlier time slots)

function parsePrestige(name: string): number {
  const m = name.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : Infinity  // no number = treated as lowest prestige
}

function sortByPrestige<T extends { name: string }>(cats: T[]): T[] {
  return [...cats].sort((a, b) => parsePrestige(b.name) - parsePrestige(a.name))
}

// ── Knockout time calculator ──────────────────────────────────────────────────
// Total minutes needed for knockout phase given numCourts dedicated to one category

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
// Finds (numGroups, teamsPerGroup) that maximises pairs within availableMins
// Correctly accounts for knockout time (groups + knockout must both fit)

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

  for (let g = minGroups; g <= 20; g++) {
    for (let t = minTeamsPerGroup; t <= 10; t++) {
      if (t - 1 < minMatchesPerTeam) continue

      const groupMatches = matchesInGroups(g, t)
      const groupSlots = Math.ceil(groupMatches / numCourts)
      const groupTime = groupSlots * (pd.groups + trans)

      const knockTeams = g * teamsAdvance
      const koTime = knockoutTimeMins(knockTeams, numCourts, pd, trans)

      if (groupTime + koTime > availableMins) break  // more t → more time, exit inner loop

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
}

export interface GeneratorResult {
  schedule: TournamentSchedule
  optimalFormat: OptimalFormat
  warnings: string[]
}

// ── Main scheduler ────────────────────────────────────────────────────────────

export function generateSchedule(config: GeneratorConfig): GeneratorResult {
  const warnings: string[] = []
  const { courts, schedule: sched, categories, format, registeredPairs } = config

  if (courts.length === 0) {
    warnings.push('No hay pistas configuradas.')
    return emptyResult(sched.endTime, format, warnings)
  }
  if (categories.length === 0) {
    warnings.push('No hay categorías configuradas.')
    return emptyResult(sched.endTime, format, warnings)
  }

  const startMins    = toMins(sched.startTime)
  const endMins      = toMins(sched.endTime)
  const trans        = sched.transitionMins
  const lunchMins    = sched.lunchBreak?.duration_minutes ?? 0
  const availableMins = endMins - startMins - lunchMins

  const pd: PhaseDurations = config.phaseDurations ?? buildPhaseDurations(config.phases)

  // Sort categories: lower prestige (higher number, "4ª") gets earlier time slots
  const sortedCats = sortByPrestige(categories)
  const numCats   = sortedCats.length
  const numCourts = courts.length

  // ── Assign courts to categories ───────────────────────────────────────────
  //
  // cats ≤ courts → one wave, distribute courts proportionally
  //   first (courts % cats) categories get (floor + 1) courts each
  //
  // cats > courts → multiple waves of `numCourts` categories each
  //   each category in a wave gets exactly 1 court (courts are reused per wave)

  interface CatAssignment {
    cat: typeof sortedCats[0]
    courtIndices: number[]
    wave: number
  }

  const assignments: CatAssignment[] = []

  if (numCats <= numCourts) {
    const base  = Math.floor(numCourts / numCats)
    const extra = numCourts % numCats
    let ci = 0
    for (let i = 0; i < numCats; i++) {
      const assigned = base + (i < extra ? 1 : 0)
      assignments.push({
        cat: sortedCats[i],
        courtIndices: Array.from({ length: assigned }, (_, j) => ci + j),
        wave: 0,
      })
      ci += assigned
    }
  } else {
    for (let i = 0; i < numCats; i++) {
      assignments.push({
        cat: sortedCats[i],
        courtIndices: [i % numCourts],
        wave: Math.floor(i / numCourts),
      })
    }
  }

  const numWaves = assignments[assignments.length - 1].wave + 1

  // ── Compute optimal format per category ───────────────────────────────────

  const catFormats: Record<string, { numGroups: number; teamsPerGroup: number }> = {}
  for (const a of assignments) {
    catFormats[a.cat.id] = findCategoryFormat(
      a.courtIndices.length,
      availableMins,
      trans,
      pd,
      format.minGroups,
      format.minTeamsPerGroup,
      format.teamsAdvancePerGroup,
      format.minMatchesPerTeam
    )
  }

  // ── Court state ───────────────────────────────────────────────────────────

  interface CourtState {
    name: string
    courtNumber: number
    cursor: number
    blocked: Interval[]
  }

  const courtStates: CourtState[] = courts.map(c => ({
    name: c.name,
    courtNumber: c.courtNumber,
    cursor: startMins,
    blocked: buildBlocked(c.breaks, sched.lunchBreak),
  }))

  const scheduledMatches: ScheduleMatch[] = []
  let waveStartTime = startMins

  // ── Schedule waves ────────────────────────────────────────────────────────

  for (let wave = 0; wave < numWaves; wave++) {
    const waveAssignments = assignments.filter(a => a.wave === wave)

    // Reset each court's cursor to wave start
    for (const a of waveAssignments) {
      for (const ci of a.courtIndices) {
        courtStates[ci].cursor = waveStartTime
      }
    }

    // Schedule all categories in this wave (they run in parallel on their own courts)
    for (const a of waveAssignments) {
      const { numGroups, teamsPerGroup } = catFormats[a.cat.id]
      const teamsAdvance = format.teamsAdvancePerGroup
      const cat = a.cat
      const catCourts = a.courtIndices.map(i => courtStates[i])

      // Build pair list
      const reg = registeredPairs?.find(r => r.category === cat.name || r.category === cat.id)
      const needed = numGroups * teamsPerGroup
      const pairList = reg ? [...reg.pairs.slice(0, needed)] : []
      while (pairList.length < needed) pairList.push(`P${pairList.length + 1}`)

      // ── Group phase ───────────────────────────────────────────────────────
      // Each group is assigned to one of the category's courts (round-robin)
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
            warnings.push(`Sin tiempo para grupo ${gl} de ${cat.name}`)
            break
          }
          scheduledMatches.push({
            id: `${cat.id}_G${gl}_m${mi + 1}`,
            courtNumber: groupCourt.courtNumber,
            courtName: groupCourt.name,
            startTime: toTime(start),
            endTime: toTime(start + pd.groups),
            categoryId: cat.id,
            categoryName: cat.name,
            groupId: `${cat.id}_G${gl}`,
            phase: `Grupo ${gl}`,
            pair1: p1,
            pair2: p2,
            matchLabel: `${cat.name} · Grupo ${gl}`,
            status: 'scheduled',
          })
          groupCourt.cursor = start + pd.groups + trans
        }
      }

      // Barrier: sync all category courts after group phase ends
      const groupEnd = Math.max(...catCourts.map(c => c.cursor))
      catCourts.forEach(c => { c.cursor = groupEnd })

      // ── Knockout phase ────────────────────────────────────────────────────
      // Each round must complete before the next round starts (barrier per round)
      const knockTeams = numGroups * teamsAdvance
      if (knockTeams >= 2) {
        let remaining = knockTeams
        let roundIdx = 0

        while (remaining >= 2) {
          const roundName = knockoutRoundName(remaining)
          const roundDuration = durationForRound(roundName, pd)
          const numMatches = Math.floor(remaining / 2)

          for (let mi = 0; mi < numMatches; mi++) {
            // Assign to earliest-free court within this category's courts
            const courtForMatch = catCourts.reduce((best, cs) =>
              cs.cursor < best.cursor ? cs : best
            )
            const start = skipBlocked(courtForMatch.cursor, roundDuration, courtForMatch.blocked)
            if (start + roundDuration > endMins) {
              warnings.push(`Sin tiempo para ${roundName} de ${cat.name}`)
              break
            }

            const p1Label = roundIdx === 0
              ? `1° Gr.${String.fromCharCode(65 + mi)}`
              : `Gan. P${mi * 2 + 1}`
            const p2Label = roundIdx === 0
              ? `2° Gr.${String.fromCharCode(65 + (mi + 1) % numGroups)}`
              : `Gan. P${mi * 2 + 2}`

            scheduledMatches.push({
              id: `${cat.id}_KO_r${roundIdx}_m${mi + 1}`,
              courtNumber: courtForMatch.courtNumber,
              courtName: courtForMatch.name,
              startTime: toTime(start),
              endTime: toTime(start + roundDuration),
              categoryId: cat.id,
              categoryName: cat.name,
              groupId: null,
              phase: roundName,
              pair1: p1Label,
              pair2: p2Label,
              matchLabel: `${cat.name} · ${roundName}`,
              status: 'scheduled',
            })
            courtForMatch.cursor = start + roundDuration + trans
          }

          // Barrier: all category courts must reach end of this round before next round
          const roundEnd = Math.max(...catCourts.map(c => c.cursor))
          catCourts.forEach(c => { c.cursor = roundEnd })

          remaining = Math.ceil(remaining / 2)
          roundIdx++
        }
      }
    }

    // Advance wave start to max cursor across all courts used in this wave
    const waveCourtStates = waveAssignments.flatMap(a => a.courtIndices.map(i => courtStates[i]))
    waveStartTime = Math.max(...waveCourtStates.map(c => c.cursor))
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

  const firstFmt = catFormats[sortedCats[0]?.id ?? ''] ?? { numGroups: format.minGroups, teamsPerGroup: format.minTeamsPerGroup }

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

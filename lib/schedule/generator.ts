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

// Push start forward until [start, start+duration) doesn't overlap any block
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

// ── Round-robin pairs (all combinations, ordered by round for court flow) ────

function roundRobinPairs(n: number): Array<[number, number]> {
  // Circle algorithm: fix position 0, rotate the rest N-1 times
  const size = n % 2 === 0 ? n : n + 1  // pad to even
  const seats = Array.from({ length: size - 1 }, (_, i) => i + 1)
  const pairs: Array<[number, number]> = []

  for (let r = 0; r < size - 1; r++) {
    // Match seat[0] (fixed=0) vs rotated position
    const rotated = r === 0 ? seats : [...seats.slice(r), ...seats.slice(0, r)]
    const opp = rotated[0]
    if (opp < n) pairs.push([0, opp])
    for (let i = 1; i < size / 2; i++) {
      const a = rotated[i]
      const b = rotated[size - 1 - i]
      if (a < n && b < n) pairs.push([a < b ? a : b, a < b ? b : a])
    }
  }

  // Deduplicate (should be clean but safety check)
  const seen = new Set<string>()
  return pairs.filter(([a, b]) => {
    const k = `${a}-${b}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ── Knockout bracket labels ───────────────────────────────────────────────────

function knockoutRoundName(teamsLeft: number): string {
  if (teamsLeft === 2) return 'Final'
  if (teamsLeft === 4) return 'Semifinal'
  if (teamsLeft === 8) return 'Cuartos de final'
  if (teamsLeft === 16) return 'Octavos de final'
  return `Ronda ${teamsLeft}`
}

// ── Optimal format finder ─────────────────────────────────────────────────────

export interface OptimalFormat {
  numGroups: number
  teamsPerGroup: number
  maxPairsPerCategory: number
  totalMatches: number
  totalSlots: number
}

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
  const base: OptimalFormat = {
    numGroups: minGroups,
    teamsPerGroup: minTeamsPerGroup,
    maxPairsPerCategory: minGroups * minTeamsPerGroup,
    totalMatches: (matchesInGroups(minGroups, minTeamsPerGroup) + matchesInKnockout(minGroups, teamsAdvance)) * numCategories,
    totalSlots,
  }

  let best = base

  for (let g = minGroups; g <= 20; g++) {
    for (let t = minTeamsPerGroup; t <= 10; t++) {
      // Minimum matches per pair constraint: round-robin gives t-1 matches per pair
      if (t - 1 < minMatchesPerTeam) continue

      const total = (matchesInGroups(g, t) + matchesInKnockout(g, teamsAdvance)) * numCategories
      if (total > totalSlots) break  // increasing t only makes it worse for this g

      const pairs = g * t
      if (pairs > best.maxPairsPerCategory) {
        best = { numGroups: g, teamsPerGroup: t, maxPairsPerCategory: pairs, totalMatches: total, totalSlots }
      }
    }
  }

  return best
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
  const { courts, schedule: sched, categories, phases, format, registeredPairs } = config

  if (courts.length === 0) {
    warnings.push('No hay pistas configuradas.')
    return emptyResult(sched.endTime, format, warnings)
  }
  if (categories.length === 0) {
    warnings.push('No hay categorías configuradas.')
    return emptyResult(sched.endTime, format, warnings)
  }

  const startMins = toMins(sched.startTime)
  const endMins   = toMins(sched.endTime)
  const trans     = sched.transitionMins

  // Match durations: groups use first phase, knockout uses last phase
  const groupDuration    = phases[0]?.maxDurationMins ?? 60
  const knockoutDuration = phases.length > 1 ? (phases[phases.length - 1]?.maxDurationMins ?? groupDuration) : groupDuration

  // Available minutes per court (deduct lunch)
  const lunchMins    = sched.lunchBreak?.duration_minutes ?? 0
  const availableMins = endMins - startMins - lunchMins

  // Slots for capacity calculation (use group duration as base unit)
  const slotDuration = groupDuration + trans
  const slotsPerCourt = Math.floor(availableMins / slotDuration)
  const totalSlots    = slotsPerCourt * courts.length

  // Find optimal format
  const optimal = findOptimalFormat(
    totalSlots,
    format.minGroups,
    format.minTeamsPerGroup,
    format.teamsAdvancePerGroup,
    format.minMatchesPerTeam,
    categories.length
  )

  const { numGroups, teamsPerGroup } = optimal
  const teamsAdvance = format.teamsAdvancePerGroup

  // Build pair lists per category
  const pairsMap: Record<string, string[]> = {}
  for (const cat of categories) {
    const reg = registeredPairs?.find(r => r.category === cat.name || r.category === cat.id)
    const needed = numGroups * teamsPerGroup
    const base   = reg?.pairs.slice(0, needed) ?? []
    while (base.length < needed) base.push(`P${base.length + 1}`)
    pairsMap[cat.id] = base
  }

  // ── Build match list (groups then knockout) ────────────────────────────────

  interface RawMatch {
    id: string
    categoryId: string
    categoryName: string
    groupId: string | null
    phase: string
    pair1: string
    pair2: string
    matchLabel: string
    duration: number
    sortKey: number   // for ordering: group index * 1000 + match index
  }

  const rawMatches: RawMatch[] = []

  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci]
    const pairs = pairsMap[cat.id]

    // Groups phase
    for (let g = 0; g < numGroups; g++) {
      const gl = String.fromCharCode(65 + g)
      const groupId = `${cat.id}_G${gl}`
      const slot = pairs.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup)
      const rrPairs = roundRobinPairs(slot.length)

      rrPairs.forEach(([i, j], mi) => {
        const p1 = slot[i] ?? `P${i + 1}`
        const p2 = slot[j] ?? `P${j + 1}`
        rawMatches.push({
          id: `${cat.id}_G${gl}_m${mi + 1}`,
          categoryId: cat.id,
          categoryName: cat.name,
          groupId,
          phase: 'groups',
          pair1: p1,
          pair2: p2,
          matchLabel: `${cat.name} Gr.${gl} — ${p1} vs ${p2}`,
          duration: groupDuration,
          sortKey: ci * 10000 + g * 1000 + mi,
        })
      })
    }

    // Knockout phase
    const knockTeams = numGroups * teamsAdvance
    if (knockTeams >= 2) {
      let remaining = knockTeams
      let roundIdx  = 0
      while (remaining >= 2) {
        const roundName = knockoutRoundName(remaining)
        const numMatches = Math.floor(remaining / 2)
        for (let mi = 0; mi < numMatches; mi++) {
          rawMatches.push({
            id: `${cat.id}_KO_r${roundIdx}_m${mi + 1}`,
            categoryId: cat.id,
            categoryName: cat.name,
            groupId: null,
            phase: roundName,
            pair1: `1° Gr.${String.fromCharCode(65 + mi * 2)}`,
            pair2: `2° Gr.${String.fromCharCode(65 + mi * 2 + 1)}`,
            matchLabel: `${cat.name} ${roundName} (${mi + 1})`,
            duration: knockoutDuration,
            sortKey: ci * 10000 + 9000 + roundIdx * 100 + mi,
          })
        }
        remaining = Math.ceil(remaining / 2)
        roundIdx++
      }
    }
  }

  // ── Court assignment ──────────────────────────────────────────────────────
  // Assign each group to a court slot using round-robin.
  // Groups → each group is assigned to one court for the whole group phase.
  // After all groups are done, knockout matches are scheduled on whichever
  // court is free earliest.

  const courtState = courts.map(c => ({
    ...c,
    cursor: startMins,
    blocked: buildBlocked(c.breaks, sched.lunchBreak),
  }))

  // Group phase: map groupId → courtIndex
  const groupCourtMap: Record<string, number> = {}
  let assignIdx = 0
  for (const cat of categories) {
    for (let g = 0; g < numGroups; g++) {
      const gl = String.fromCharCode(65 + g)
      groupCourtMap[`${cat.id}_G${gl}`] = assignIdx % courts.length
      assignIdx++
    }
  }

  const scheduledMatches: ScheduleMatch[] = []

  // Sort raw matches: groups first (by category × group × match), knockout after
  const groups   = rawMatches.filter(m => m.phase === 'groups').sort((a, b) => a.sortKey - b.sortKey)
  const knockout = rawMatches.filter(m => m.phase !== 'groups').sort((a, b) => a.sortKey - b.sortKey)

  function scheduleMatch(m: RawMatch, courtIdx: number): boolean {
    const cs = courtState[courtIdx]
    const start = skipBlocked(cs.cursor, m.duration, cs.blocked)
    if (start + m.duration > endMins) {
      warnings.push(`Sin tiempo para: ${m.matchLabel}`)
      return false
    }
    scheduledMatches.push({
      id: m.id,
      courtNumber: cs.courtNumber,
      courtName: cs.name,
      startTime: toTime(start),
      endTime: toTime(start + m.duration),
      categoryId: m.categoryId,
      categoryName: m.categoryName,
      groupId: m.groupId,
      phase: m.phase,
      pair1: m.pair1,
      pair2: m.pair2,
      matchLabel: m.matchLabel,
      status: 'scheduled',
    })
    cs.cursor = start + m.duration + trans
    return true
  }

  // Schedule groups
  for (const m of groups) {
    const ci = groupCourtMap[m.groupId ?? ''] ?? 0
    scheduleMatch(m, ci)
  }

  // Knockout: after all group matches, use earliest-free court each time
  const maxGroupCursor = Math.max(...courtState.map(c => c.cursor))
  courtState.forEach(c => { if (c.cursor < maxGroupCursor) c.cursor = maxGroupCursor })

  for (const m of knockout) {
    // Pick the court that will be free soonest
    const ci = courtState.reduce((best, cs, i) => cs.cursor < courtState[best].cursor ? i : best, 0)
    scheduleMatch(m, ci)
  }

  // ── Summary ────────────────────────────────────────────────────────────────

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

  const summary: ScheduleSummary = {
    totalMatches: scheduledMatches.length,
    estimatedEndTime,
    courtsUsed,
    matchesPerCategory,
    finalTimes,
    warnings,
  }

  const explanation = [
    `${numGroups} grupos de ${teamsPerGroup} parejas por categoría.`,
    `Capacidad máxima: ${optimal.maxPairsPerCategory} parejas/categoría.`,
    `${scheduledMatches.length} partidos · fin estimado ${estimatedEndTime}.`,
  ].join(' ')

  return {
    schedule: { matches: scheduledMatches, summary, rawExplanation: explanation },
    optimalFormat: optimal,
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

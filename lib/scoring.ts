export interface MatchConfig {
  sets_format: string               // BEST_OF_1 | BEST_OF_2_SUPERTB | BEST_OF_3
  games_to_win_set: number          // 1-9
  deuce_mode: string                // ADVANTAGE | GOLDEN_POINT | STAR_POINT
  deciding_set_format?: string      // FULL_SET | TIEBREAK_7 | SUPER_TIEBREAK_10
  tiebreak_points?: number
  super_tiebreak_points?: number
  time_limit_minutes?: number | null
}

export interface SetScore {
  vosotros: number
  rival: number
}

/** Returns the number of sets the winner needs (1, or 2 for BEST_OF_3) */
export function getExpectedSetsToWin(config: MatchConfig): number {
  if (config.sets_format === 'BEST_OF_1') return 1
  if (config.sets_format === 'BEST_OF_2_SUPERTB') return 2
  if (config.sets_format === 'BEST_OF_3') return 2
  return 1
}

/**
 * Returns whether a single set score is valid given the config and position.
 * setIndex is 0-based. totalSets is the total number of sets played.
 */
export function isValidSetScore(
  s: SetScore,
  config: MatchConfig,
  setIndex: number,
  totalSets: number
): boolean {
  const N = config.games_to_win_set
  const a = s.vosotros
  const b = s.rival

  // Determine if this set is the deciding (last) set in a BEST_OF_3 or BEST_OF_2_SUPERTB
  const isDecidingSet =
    config.sets_format !== 'BEST_OF_1' &&
    setIndex === totalSets - 1 &&
    (config.sets_format === 'BEST_OF_3'
      ? totalSets === 3
      : config.sets_format === 'BEST_OF_2_SUPERTB'
      ? totalSets === 3 // third set after 1-1
      : false)

  if (isDecidingSet && config.deciding_set_format === 'SUPER_TIEBREAK_10') {
    const target = config.super_tiebreak_points ?? 10
    const winner = Math.max(a, b)
    const loser = Math.min(a, b)
    if (winner < target) return false
    // Must win by 2 or reach exactly target with loser < target - 1
    if (loser === target - 1) return winner === target // exactly target vs target-1
    return winner === target && loser < target - 1
  }

  if (isDecidingSet && config.deciding_set_format === 'TIEBREAK_7') {
    const target = config.tiebreak_points ?? 7
    const winner = Math.max(a, b)
    const loser = Math.min(a, b)
    if (winner < target) return false
    if (loser === target - 1) return winner === target
    return winner === target && loser < target - 1
  }

  // Regular set
  const winner = Math.max(a, b)
  const loser = Math.min(a, b)

  if (winner === N) {
    // Standard win: N-x where x <= N-2
    if (loser <= N - 2) return true
    // Tie-break win: N-(N-1) — valid in regular sets
    if (loser === N - 1) return true
    return false
  }

  if (winner === N + 1) {
    // Advantage set: winner by 2 — only valid for ADVANTAGE deuce
    if (config.deuce_mode === 'ADVANTAGE') {
      return loser === N
    }
    return false
  }

  return false
}

/**
 * Validates all sets of a submitted match score against the phase's match_config.
 * Returns { valid: true } or { valid: false, error: string }
 */
export function validateMatchScore(
  sets: SetScore[],
  config: MatchConfig
): { valid: boolean; error?: string } {
  if (!sets || sets.length === 0) {
    return { valid: false, error: 'No se han introducido sets' }
  }

  const setsToWin = getExpectedSetsToWin(config)

  // Count sets won by each side
  let wins1 = 0
  let wins2 = 0
  for (const s of sets) {
    if (s.vosotros > s.rival) wins1++
    else if (s.rival > s.vosotros) wins2++
  }

  // Validate total sets count vs format
  if (config.sets_format === 'BEST_OF_1') {
    if (sets.length !== 1) return { valid: false, error: 'Este formato usa exactamente 1 set' }
  } else if (config.sets_format === 'BEST_OF_2_SUPERTB') {
    if (sets.length < 2 || sets.length > 3) {
      return { valid: false, error: 'Este formato necesita 2 o 3 sets' }
    }
  } else if (config.sets_format === 'BEST_OF_3') {
    if (sets.length < 2 || sets.length > 3) {
      return { valid: false, error: 'Este formato usa entre 2 y 3 sets' }
    }
  }

  // Winner must have exactly setsToWin
  const maxWins = Math.max(wins1, wins2)
  if (maxWins < setsToWin) {
    return {
      valid: false,
      error: `El ganador debe haber ganado ${setsToWin} set(s), pero el máximo es ${maxWins}`,
    }
  }

  // Validate each set score
  for (let i = 0; i < sets.length; i++) {
    if (!isValidSetScore(sets[i], config, i, sets.length)) {
      return {
        valid: false,
        error: `El marcador del set ${i + 1} no es válido (${sets[i].vosotros}-${sets[i].rival})`,
      }
    }
  }

  // Winner coherence: team with most sets is the winner
  if (wins1 === wins2) {
    return { valid: false, error: 'No hay un ganador claro (sets empatados)' }
  }

  return { valid: true }
}

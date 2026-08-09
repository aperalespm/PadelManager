'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MatchScoreSheet } from './MatchScoreSheet'

export interface ClientMatch {
  id: string
  team1RegId: string | null
  team2RegId: string | null
  winnerRegId: string | null
  t1Name: string
  t2Name: string
  courtName: string
  scheduledAt: string | null
  phaseName: string
  round: number
  matchNumber: number
  groupLabel: string | null
  categoryLabel: string | null
  status: string
  finalScore: Array<{ vosotros: number; rival: number }> | null
}

interface Props {
  matches: ClientMatch[]
  tournamentId: string
  tournamentName: string
  scoringSystem: string
  tiebreakCriteria: string[]
  teamsAdvancingPerGroup: number
}

type Tab = 'matches' | 'standings'
type StatusFilter = 'all' | 'pending' | 'active' | 'finished'

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function scoreStr(fs: Array<{ vosotros: number; rival: number }> | null) {
  if (!fs || fs.length === 0) return null
  return fs.map(s => `${s.vosotros}–${s.rival}`).join('  ')
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', active: 'En curso', finished: 'Finalizado', disputed: 'Disputa', bye: 'Libre',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'text-muted-foreground bg-muted',
  active: 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/60',
  finished: 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/60',
  disputed: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950/60',
  bye: 'text-muted-foreground bg-muted',
}

interface StandingRow {
  regId: string; name: string
  played: number; won: number; lost: number
  setsWon: number; setsLost: number; gamesWon: number; gamesLost: number; points: number
}

function computeStandings(
  matches: ClientMatch[],
  scoringSystem: string,
  tiebreakCriteria: string[],
): Array<{ category: string; group: string; teams: (StandingRow & { rank: number; advances: boolean })[] }> {
  const finished = matches.filter(m => m.status === 'finished' && m.groupLabel && m.team1RegId && m.team2RegId)
  const catGroupStats = new Map<string, Map<string, Map<string, StandingRow>>>()

  const getStats = (cat: string, grp: string, regId: string, name: string): StandingRow => {
    if (!catGroupStats.has(cat)) catGroupStats.set(cat, new Map())
    const cg = catGroupStats.get(cat)!
    if (!cg.has(grp)) cg.set(grp, new Map())
    const gm = cg.get(grp)!
    if (!gm.has(regId)) gm.set(regId, { regId, name, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, points: 0 })
    return gm.get(regId)!
  }

  for (const m of finished) {
    const cat = m.categoryLabel!; const grp = m.groupLabel!
    const s1 = getStats(cat, grp, m.team1RegId!, m.t1Name)
    const s2 = getStats(cat, grp, m.team2RegId!, m.t2Name)
    s1.played++; s2.played++
    const t1Won = m.winnerRegId === m.team1RegId
    if (t1Won) { s1.won++; s2.lost++ } else { s2.won++; s1.lost++ }
    if (scoringSystem === 'WIN_LOSS') { if (t1Won) s1.points += 2; else s2.points += 2 }
    if (m.finalScore) {
      for (const set of m.finalScore) {
        s1.gamesWon += set.vosotros; s1.gamesLost += set.rival
        s2.gamesWon += set.rival; s2.gamesLost += set.vosotros
        if (set.vosotros > set.rival) { s1.setsWon++; s2.setsLost++ }
        else if (set.rival > set.vosotros) { s2.setsWon++; s1.setsLost++ }
      }
      if (scoringSystem === 'GAMES_WON') { s1.points = s1.gamesWon; s2.points = s2.gamesWon }
      else if (scoringSystem === 'SETS_WON') { s1.points = s1.setsWon; s2.points = s2.setsWon }
    }
  }

  function sortTeams(teams: StandingRow[]) {
    return [...teams].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      for (const c of tiebreakCriteria) {
        let d = 0
        if (c === 'SET_DIFFERENCE') d = (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost)
        else if (c === 'GAME_DIFFERENCE') d = (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost)
        else if (c === 'GAMES_WON') d = b.gamesWon - a.gamesWon
        else if (c === 'RANDOM') d = a.regId < b.regId ? -1 : 1
        if (d !== 0) return d
      }
      return 0
    })
  }

  // Count teams per group (from all group matches, not just finished)
  const allGroupTeams = new Map<string, Set<string>>()
  for (const m of matches.filter(mm => mm.groupLabel)) {
    const key = `${m.categoryLabel}::${m.groupLabel}`
    if (!allGroupTeams.has(key)) allGroupTeams.set(key, new Set())
    if (m.team1RegId) allGroupTeams.get(key)!.add(m.team1RegId)
    if (m.team2RegId) allGroupTeams.get(key)!.add(m.team2RegId)
  }

  const result: Array<{ category: string; group: string; teams: (StandingRow & { rank: number; advances: boolean })[] }> = []

  for (const [cat, cgMap] of catGroupStats) {
    for (const [grp, gMap] of cgMap) {
      const key = `${cat}::${grp}`
      const totalTeams = allGroupTeams.get(key)?.size ?? gMap.size
      const sorted = sortTeams([...gMap.values()])
      // Advancing: top 2 or top half, min 1
      const advancing = Math.min(2, Math.max(1, Math.floor(totalTeams / 2)))
      result.push({
        category: cat,
        group: grp,
        teams: sorted.map((t, i) => ({ ...t, rank: i + 1, advances: i < advancing })),
      })
    }
  }

  result.sort((a, b) => a.category.localeCompare(b.category) || a.group.localeCompare(b.group))
  return result
}

export function VivoClient({ matches, tournamentId, tournamentName, scoringSystem, tiebreakCriteria, teamsAdvancingPerGroup }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('matches')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [groupFilter, setGroupFilter] = useState('')
  const [activeSheet, setActiveSheet] = useState<ClientMatch | null>(null)
  const [koBanner, setKoBanner] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState<string | null>(null)

  async function handleSeed() {
    setSeeding(true)
    setSeedMsg(null)
    try {
      const res = await fetch(`/api/seed-test?id=${tournamentId}`)
      const json = await res.json()
      if (!res.ok) {
        setSeedMsg(`Error: ${json.error}`)
      } else {
        setSeedMsg(`✓ ${json.pairsInserted} parejas insertadas, ${json.matchesGenerated} partidos generados`)
        router.refresh()
      }
    } catch {
      setSeedMsg('Error al conectar con el servidor')
    } finally {
      setSeeding(false)
    }
  }

  useEffect(() => {
    if (koBanner) {
      const t = setTimeout(() => setKoBanner(false), 5000)
      return () => clearTimeout(t)
    }
  }, [koBanner])

  const visibleMatches = matches.filter(m => m.status !== 'bye')

  const allCategories = useMemo(() => {
    const cats = new Set(visibleMatches.map(m => m.categoryLabel).filter(Boolean) as string[])
    return [...cats].sort()
  }, [visibleMatches])

  const allGroups = useMemo(() => {
    const src = categoryFilter ? visibleMatches.filter(m => m.categoryLabel === categoryFilter) : visibleMatches
    const grps = new Set(src.map(m => m.groupLabel).filter(Boolean) as string[])
    return [...grps].sort()
  }, [visibleMatches, categoryFilter])

  const hasGroups = useMemo(() => visibleMatches.some(m => m.groupLabel), [visibleMatches])

  const filtered = useMemo(() => {
    return visibleMatches.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (categoryFilter && m.categoryLabel !== categoryFilter) return false
      if (groupFilter && m.groupLabel !== groupFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!m.t1Name.toLowerCase().includes(q) && !m.t2Name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [visibleMatches, statusFilter, categoryFilter, groupFilter, search])

  const standings = useMemo(
    () => computeStandings(matches, scoringSystem, tiebreakCriteria),
    [matches, scoringSystem, tiebreakCriteria]
  )

  const active = visibleMatches.filter(m => m.status === 'active' || m.status === 'disputed').length
  const pending = visibleMatches.filter(m => m.status === 'pending').length
  const finished = visibleMatches.filter(m => m.status === 'finished').length

  function handleSuccess(allGroupsDone: boolean) {
    setActiveSheet(null)
    if (allGroupsDone) setKoBanner(true)
    router.refresh()
  }

  const canOpenSheet = (m: ClientMatch) =>
    m.status !== 'bye' && m.team1RegId && m.team2RegId

  return (
    <div className="flex flex-col h-full">
      {/* KO banner */}
      {koBanner && (
        <div className="mx-4 mt-3 px-4 py-3 bg-accent text-accent-foreground rounded-xl text-[14px] font-semibold text-center shadow-lg">
          ¡Fase de grupos terminada! Se ha generado el cuadro de eliminación automáticamente.
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 pt-4 pb-6 overflow-y-auto flex-1">
        {/* Header */}
        <div>
          <h1 className="text-[20px] font-extrabold text-foreground tracking-[-0.5px]">En vivo</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{tournamentName}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { n: active, label: 'Activos', color: 'text-amber-600 dark:text-amber-400' },
            { n: pending, label: 'Pendientes', color: 'text-accent' },
            { n: finished, label: 'Terminados', color: 'text-emerald-600 dark:text-emerald-400' },
          ].map(({ n, label, color }) => (
            <div key={label} className="bg-card border border-border rounded-[10px] py-3 px-3 text-center">
              <p className={cn('text-[26px] font-extrabold leading-none tabular-nums', color)}>{n}</p>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        {hasGroups && (
          <div className="flex bg-muted rounded-xl p-0.5 gap-0.5">
            {(['matches', 'standings'] as Tab[]).map(t => (
              <button key={t} type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2 rounded-[10px] text-[13px] font-semibold transition-colors',
                  tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                )}>
                {t === 'matches' ? 'Partidos' : 'Clasificaciones'}
              </button>
            ))}
          </div>
        )}

        {/* ── MATCHES TAB ── */}
        {tab === 'matches' && (
          <>
            {/* Search */}
            <input
              type="search"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-[14px] bg-background outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />

            {/* Filters row */}
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="border border-border rounded-xl px-3 py-2.5 text-[14px] bg-background text-foreground outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="pending">Pendientes</option>
                <option value="finished">Terminados</option>
              </select>

              <select
                value={categoryFilter}
                onChange={e => { setCategoryFilter(e.target.value); setGroupFilter('') }}
                className="border border-border rounded-xl px-3 py-2.5 text-[14px] bg-background text-foreground outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              >
                <option value="">Todas las categorías</option>
                {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              <select
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
                className="border border-border rounded-xl px-3 py-2.5 text-[14px] bg-background text-foreground outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              >
                <option value="">Todos los grupos</option>
                {allGroups.map(grp => <option key={grp} value={grp}>{grp}</option>)}
              </select>
            </div>

            {/* Match list */}
            <div className="flex flex-col gap-2">
              {filtered.length === 0 && matches.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-10">
                  <p className="text-[14px] text-muted-foreground text-center">No hay partidos generados todavía.</p>
                  <button
                    type="button"
                    onClick={handleSeed}
                    disabled={seeding}
                    className="px-5 py-3 rounded-xl bg-accent text-accent-foreground text-[14px] font-semibold disabled:opacity-50"
                  >
                    {seeding ? 'Generando datos…' : '🎾 Poblar con datos de prueba'}
                  </button>
                  {seedMsg && (
                    <p className={cn('text-[13px] text-center', seedMsg.startsWith('Error') ? 'text-red-500' : 'text-emerald-600')}>{seedMsg}</p>
                  )}
                </div>
              )}
              {filtered.length === 0 && matches.length > 0 && (
                <p className="text-[14px] text-muted-foreground text-center py-8">No hay partidos que coincidan</p>
              )}
              {filtered.map(m => {
                const canOpen = canOpenSheet(m)
                const isFinished = m.status === 'finished'
                const winnerIs1 = m.winnerRegId === m.team1RegId
                const score = scoreStr(m.finalScore)

                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!canOpen}
                    onClick={() => canOpen && setActiveSheet(m)}
                    className={cn(
                      'text-left w-full rounded-xl border bg-card transition-all',
                      canOpen ? 'active:scale-[0.98] cursor-pointer' : 'cursor-default opacity-60',
                      m.status === 'active' ? 'border-amber-300 dark:border-amber-700' : 'border-border',
                      isFinished && 'opacity-80'
                    )}
                  >
                    <div className="px-4 pt-3 pb-2">
                      {/* Meta row */}
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <p className="text-[11px] font-semibold text-muted-foreground truncate">
                          {m.courtName}{m.scheduledAt ? ` · ${fmt(m.scheduledAt)}` : ''}
                          {m.groupLabel ? ` · ${m.groupLabel}` : ''}
                          {m.categoryLabel ? ` · ${m.categoryLabel}` : ''}
                        </p>
                        <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0', STATUS_COLOR[m.status])}>
                          {STATUS_LABEL[m.status] ?? m.status}
                        </span>
                      </div>

                      {/* Teams + score */}
                      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                        <div className="min-w-0">
                          <p className={cn('text-[14px] font-semibold truncate', isFinished && winnerIs1 ? 'text-foreground' : 'text-foreground/80')}>
                            {isFinished && winnerIs1 && <span className="text-accent mr-1">▶</span>}
                            {m.t1Name}
                          </p>
                          <p className={cn('text-[14px] font-semibold truncate mt-0.5', isFinished && !winnerIs1 ? 'text-foreground' : 'text-foreground/80')}>
                            {isFinished && !winnerIs1 && <span className="text-accent mr-1">▶</span>}
                            {m.t2Name}
                          </p>
                        </div>

                        {score ? (
                          <div className="text-right shrink-0">
                            {m.finalScore!.map((s, i) => (
                              <p key={i} className="text-[13px] font-bold tabular-nums text-foreground leading-snug">
                                {s.vosotros}–{s.rival}
                              </p>
                            ))}
                          </div>
                        ) : canOpen ? (
                          <p className="text-[12px] text-accent font-semibold shrink-0">Intro. →</p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* ── STANDINGS TAB ── */}
        {tab === 'standings' && (
          <div className="flex flex-col gap-6">
            {standings.length === 0 && (
              <p className="text-[14px] text-muted-foreground text-center py-8">
                Las clasificaciones aparecerán cuando se introduzcan resultados de grupo.
              </p>
            )}
            {standings.map(({ category, group, teams }) => (
              <div key={`${category}::${group}`}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{category}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">· {group}</p>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-2 px-3 py-2 bg-muted/50 border-b border-border">
                    {['#', 'Equipo', 'J', 'G', 'P', 'Pts'].map(h => (
                      <p key={h} className="text-[10px] font-bold text-muted-foreground uppercase text-center last:text-right first:text-left">{h}</p>
                    ))}
                  </div>
                  {teams.map(t => (
                    <div key={t.regId}
                      className={cn(
                        'grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-2 px-3 py-2.5 border-b border-border last:border-0 items-center',
                        t.advances ? 'bg-accent/5' : ''
                      )}>
                      <p className={cn('text-[12px] font-bold w-4', t.rank <= 2 && t.advances ? 'text-accent' : 'text-muted-foreground')}>
                        {t.rank}
                      </p>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{t.name}</p>
                        {t.advances && (
                          <p className="text-[10px] font-bold text-accent">Pasa de fase ✓</p>
                        )}
                      </div>
                      <p className="text-[12px] tabular-nums text-center text-muted-foreground">{t.played}</p>
                      <p className="text-[12px] tabular-nums text-center text-emerald-600 dark:text-emerald-400 font-semibold">{t.won}</p>
                      <p className="text-[12px] tabular-nums text-center text-red-500 font-semibold">{t.lost}</p>
                      <p className="text-[12px] tabular-nums text-right font-bold text-foreground">{t.points}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Score sheet */}
      {activeSheet && (
        <MatchScoreSheet
          match={{
            id: activeSheet.id,
            t1Name: activeSheet.t1Name,
            t2Name: activeSheet.t2Name,
            courtName: activeSheet.courtName,
            scheduledAt: activeSheet.scheduledAt,
            status: activeSheet.status,
            finalScore: activeSheet.finalScore,
          }}
          onClose={() => setActiveSheet(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}

import { cn } from '@/lib/utils'

interface TournamentBracketProps {
  matches: Record<string, unknown>[]
  highlightRegId?: string
  mode: 'player' | 'admin'
}

function teamDisplay(m: Record<string, unknown>, slot: 1 | 2) {
  if (slot === 1) return m.t1p1_name ? `${m.t1p1_name}${m.t1p2_name_display ? ` / ${m.t1p2_name_display}` : ''}` : 'Pendiente'
  return m.t2p1_name ? `${m.t2p1_name}${m.t2p2_name_display ? ` / ${m.t2p2_name_display}` : ''}` : 'Pendiente'
}

function MatchCard({ match: m, highlightRegId }: { match: Record<string, unknown>; highlightRegId?: string }) {
  const status = m.status as string
  const isTeam1Highlight = !!highlightRegId && m.team1_reg_id === highlightRegId
  const isTeam2Highlight = !!highlightRegId && m.team2_reg_id === highlightRegId
  const team1IsWinner = m.winner_reg_id === m.team1_reg_id
  const team2IsWinner = m.winner_reg_id === m.team2_reg_id

  const team1 = teamDisplay(m, 1)
  const team2 = teamDisplay(m, 2)

  const score = m.final_score as Array<{ vosotros: number; rival: number }> | null
  const scoreStr = score ? score.map(s => `${s.vosotros}–${s.rival}`).join(', ') : status === 'active' ? '…' : '—'

  const statusEl = status === 'finished'
    ? <span className="text-xs text-[var(--success)]">✓ Finalizado</span>
    : status === 'active'
    ? <span className="text-xs text-[var(--warning)]">● En juego</span>
    : status === 'disputed'
    ? <span className="text-xs text-[var(--error)]">⚠️ Disputa</span>
    : <span className="text-xs text-muted-foreground">◦ Pendiente</span>

  return (
    <div className={cn(
      'rounded-lg border border-border bg-card text-sm overflow-hidden',
      (isTeam1Highlight || isTeam2Highlight) && 'border-accent'
    )}>
      {/* Team 1 */}
      <div className={cn(
        'px-3 py-2 flex items-center justify-between gap-2',
        team1IsWinner && 'bg-accent text-accent-foreground',
        !team1IsWinner && isTeam1Highlight && 'bg-[var(--accent-surface)]',
      )}>
        <span className={cn('truncate max-w-[150px] flex items-center gap-1', !team1IsWinner && isTeam1Highlight && 'text-accent font-medium')}>
          {isTeam1Highlight && <span className="text-[10px] font-semibold bg-accent text-accent-foreground px-1 py-0.5 rounded shrink-0">Tú</span>}
          {team1}
        </span>
        {team1IsWinner && <span className="text-xs font-semibold shrink-0">✓ Ganador</span>}
      </div>
      <div className="h-px bg-border" />
      {/* Team 2 */}
      <div className={cn(
        'px-3 py-2 flex items-center justify-between gap-2',
        team2IsWinner && 'bg-accent text-accent-foreground',
        !team2IsWinner && isTeam2Highlight && 'bg-[var(--accent-surface)]',
      )}>
        <span className={cn('truncate max-w-[150px] flex items-center gap-1', !team2IsWinner && isTeam2Highlight && 'text-accent font-medium')}>
          {isTeam2Highlight && <span className="text-[10px] font-semibold bg-accent text-accent-foreground px-1 py-0.5 rounded shrink-0">Tú</span>}
          {team2}
        </span>
        {team2IsWinner && <span className="text-xs font-semibold shrink-0">✓ Ganador</span>}
      </div>
      {/* Footer */}
      <div className="px-3 py-1.5 bg-muted/40 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{scoreStr}</span>
        {statusEl}
      </div>
    </div>
  )
}

export function TournamentBracket({ matches, highlightRegId, mode }: TournamentBracketProps) {
  const byPhase: Record<string, Record<string, unknown>[]> = {}
  for (const m of matches) {
    const phaseName = (m.phase_name as string) ?? 'Fase 1'
    if (!byPhase[phaseName]) byPhase[phaseName] = []
    byPhase[phaseName].push(m)
  }

  const phases = Object.keys(byPhase)

  if (mode === 'player') {
    return (
      <div className="flex flex-col gap-6 max-w-md mx-auto">
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <span className="text-[var(--success)]">● Finalizado</span>
          <span className="text-[var(--warning)]">● En juego</span>
          <span className="text-muted-foreground">◦ Pendiente</span>
          {highlightRegId && <span className="text-accent">□ Tu pareja</span>}
        </div>
        {phases.map(phase => (
          <div key={phase} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{phase}</h3>
            {byPhase[phase].map(m => (
              <MatchCard key={m.id as string} match={m} highlightRegId={highlightRegId} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Admin: horizontal columns
  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-[var(--success)]">● Finalizado</span>
        <span className="text-[var(--warning)]">● En juego</span>
        <span className="text-muted-foreground">◦ Pendiente</span>
      </div>
      <div className="flex gap-6 overflow-x-auto pb-4">
        {phases.map(phase => (
          <div key={phase} className="flex flex-col gap-2 min-w-[220px]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center pb-1 border-b border-border">{phase}</h3>
            <div className="flex flex-col gap-2">
              {byPhase[phase].map(m => (
                <MatchCard key={m.id as string} match={m} />
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-col items-center justify-start pt-6 min-w-[80px]">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">CAMPEÓN</p>
          <span className="text-4xl">🏆</span>
        </div>
      </div>
    </div>
  )
}

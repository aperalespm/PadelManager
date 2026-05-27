import { cn } from '@/lib/utils'

interface TournamentBracketProps {
  matches: Record<string, unknown>[]
  highlightRegId?: string
  mode: 'player' | 'admin'
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'finished': return { label: '✓ Finalizado', className: 'text-[var(--success)]' }
    case 'active': return { label: '● En juego', className: 'text-[var(--warning)]' }
    case 'disputed': return { label: '⚠️ Disputa', className: 'text-[var(--error)]' }
    default: return { label: '◦ Pendiente', className: 'text-muted-foreground' }
  }
}

function MatchCard({ match: m, highlightRegId }: { match: Record<string, unknown>; highlightRegId?: string }) {
  const status = m.status as string
  const { label, className } = getStatusConfig(status)
  const isTeam1Highlight = highlightRegId && m.team1_reg_id === highlightRegId
  const isTeam2Highlight = highlightRegId && m.team2_reg_id === highlightRegId

  const team1 = m.t1p1_name
    ? `${m.t1p1_name}${m.t1p2_name_display ? ` / ${m.t1p2_name_display}` : ''}`
    : 'Pendiente'
  const team2 = m.t2p1_name
    ? `${m.t2p1_name}${m.t2p2_name_display ? ` / ${m.t2p2_name_display}` : ''}`
    : 'Pendiente'

  const score = m.final_score as Array<{ vosotros: number; rival: number }> | null
  const scoreStr = score ? score.map(s => `${s.vosotros}–${s.rival}`).join(', ') : m.status === 'active' ? '…' : '—'

  return (
    <div className={cn(
      'rounded-lg border border-border bg-card text-sm overflow-hidden',
      (isTeam1Highlight || isTeam2Highlight) && 'border-accent'
    )}>
      <div className={cn(
        'px-3 py-2 flex items-center justify-between',
        isTeam1Highlight && 'bg-[var(--accent-surface)]',
        m.winner_reg_id === m.team1_reg_id && 'font-semibold'
      )}>
        <span className={cn(
          'truncate max-w-[140px]',
          isTeam1Highlight && 'text-accent font-medium'
        )}>
          {isTeam1Highlight && <span className="text-xs mr-1">Tú</span>}
          {team1}
        </span>
        {m.winner_reg_id === m.team1_reg_id && <span className="text-[var(--success)] text-xs ml-1">✓</span>}
      </div>
      <div className="h-px bg-border" />
      <div className={cn(
        'px-3 py-2 flex items-center justify-between',
        isTeam2Highlight && 'bg-[var(--accent-surface)]',
        m.winner_reg_id === m.team2_reg_id && 'font-semibold'
      )}>
        <span className={cn(
          'truncate max-w-[140px]',
          isTeam2Highlight && 'text-accent font-medium'
        )}>
          {isTeam2Highlight && <span className="text-xs mr-1">Tú</span>}
          {team2}
        </span>
        {m.winner_reg_id === m.team2_reg_id && <span className="text-[var(--success)] text-xs ml-1">✓</span>}
      </div>
      <div className="px-3 py-1.5 bg-muted/50 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{scoreStr}</span>
        <span className={cn('text-xs', className)}>{label}</span>
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
          <span className="flex items-center gap-1 text-[var(--success)]">● Finalizado</span>
          <span className="flex items-center gap-1 text-[var(--warning)]">● En juego</span>
          <span className="flex items-center gap-1 text-muted-foreground">◦ Pendiente</span>
          {highlightRegId && <span className="flex items-center gap-1 text-accent">□ Tu pareja</span>}
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
    <div className="flex gap-4 overflow-x-auto pb-4">
      {/* Legend */}
      <div className="flex flex-col gap-8 w-full">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-[var(--success)]">● Finalizado</span>
          <span className="flex items-center gap-1 text-[var(--warning)]">● En juego</span>
          <span className="flex items-center gap-1 text-muted-foreground">◦ Pendiente</span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {phases.map(phase => (
            <div key={phase} className="flex flex-col gap-2 min-w-[200px]">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">{phase}</h3>
              {byPhase[phase].map(m => (
                <MatchCard key={m.id as string} match={m} highlightRegId={highlightRegId} />
              ))}
            </div>
          ))}
          <div className="flex flex-col items-center justify-center min-w-[80px]">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">CAMPEÓN</p>
            <span className="text-4xl">🏆</span>
          </div>
        </div>
      </div>
    </div>
  )
}

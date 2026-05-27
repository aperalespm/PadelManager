import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function EnVivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const t = tournament as Record<string, unknown>
  const matches = await getMatchesForTournament(id) as Record<string, unknown>[]

  const active = matches.filter(m => m.status === 'active')
  const pending = matches.filter(m => m.status === 'pending')
  const finished = matches.filter(m => m.status === 'finished')
  const disputed = matches.filter(m => m.status === 'disputed')

  function teamName(m: Record<string, unknown>, slot: 1 | 2) {
    if (slot === 1) return `${m.t1p1_name ?? 'Equipo 1'}${m.t1p2_name_display ? ` / ${m.t1p2_name_display}` : ''}`
    return `${m.t2p1_name ?? 'Equipo 2'}${m.t2p2_name_display ? ` / ${m.t2p2_name_display}` : ''}`
  }

  function scoreStr(m: Record<string, unknown>) {
    const score = m.final_score as Array<{ vosotros: number; rival: number }> | null
    if (!score) return '—'
    return score.map(s => `${s.vosotros}–${s.rival}`).join(', ')
  }

  function matchTime(m: Record<string, unknown>) {
    if (!m.scheduled_at) return null
    return new Date(m.scheduled_at as string).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">En vivo</h1>
          <p className="text-sm text-muted-foreground">{t.name as string} · Fase de octavos</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[var(--warning)] text-[var(--warning-foreground)]">● En curso</Badge>
          <Button variant="outline" size="sm">Filtrar fase</Button>
          <Button variant="outline" size="sm">Filtrar categoría</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-3xl font-bold text-[var(--warning)]">{active.length + disputed.length}</p>
          <p className="text-sm text-muted-foreground">Partidos activos</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-3xl font-bold text-accent">{pending.length}</p>
          <p className="text-sm text-muted-foreground">Pendientes</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-3xl font-bold text-[var(--success)]">{finished.length}</p>
          <p className="text-sm text-muted-foreground">Finalizados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active matches */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PARTIDOS ACTIVOS</h2>
          {active.length === 0 && disputed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay partidos activos</p>
          ) : (
            [...active, ...disputed].map(m => (
              <div key={m.id as string} className="bg-card border border-border rounded-xl overflow-hidden border-l-4 border-l-[var(--warning)]">
                <div className="px-4 py-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--warning)] uppercase tracking-wide">
                        {m.court_name as string ?? 'Pista'} · {m.phase_name as string ?? 'Fase'}
                      </p>
                      <p className="font-semibold text-foreground mt-1 truncate">{teamName(m, 1)}</p>
                      <p className="text-sm text-muted-foreground truncate">{teamName(m, 2)}</p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="font-bold text-lg text-foreground leading-none">{scoreStr(m)}</p>
                      {matchTime(m) && (
                        <p className="text-xs text-muted-foreground mt-1">⊙ {matchTime(m)}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm">Intervenir</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent results + upcoming */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">ÚLTIMOS RESULTADOS</h2>
            <div className="flex flex-col gap-2">
              {[...finished.slice(-5).reverse(), ...disputed.slice(-3)].map(m => {
                const isDisputed = m.status === 'disputed'
                const winnerSlot = m.winner_reg_id === m.team1_reg_id ? 1 : 2
                const loserSlot = winnerSlot === 1 ? 2 : 1
                const resultText = isDisputed
                  ? `${teamName(m, 1)} — resultado en disputa`
                  : `${teamName(m, winnerSlot)} def. ${teamName(m, loserSlot)}`

                return (
                  <div key={m.id as string} className="bg-card border border-border rounded-xl px-4 py-3 border-l-4 border-l-accent">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{resultText}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.player1_category as string ?? 'Cat. —'} · {scoreStr(m)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isDisputed ? (
                          <>
                            <Badge className="bg-[var(--error)] text-[var(--error-foreground)] text-xs">Disputa</Badge>
                            <Button variant="outline" size="sm" className="text-xs h-7 px-2 text-[var(--warning)] border-[var(--warning)]">
                              Resolver disputa
                            </Button>
                          </>
                        ) : (
                          <Badge className="bg-[var(--success-surface)] text-[var(--success)] text-xs">Validado</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">PRÓXIMOS PARTIDOS</h2>
            <div className="flex flex-col gap-1">
              {pending.slice(0, 5).map(m => (
                <div key={m.id as string} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0 gap-2">
                  <span className="text-muted-foreground shrink-0">{m.court_name as string ?? 'Pista —'}</span>
                  {matchTime(m) && <span className="text-muted-foreground shrink-0">{matchTime(m)}</span>}
                  <span className="text-foreground truncate flex-1 px-2">{teamName(m, 1)} vs {teamName(m, 2)}</span>
                  <Badge variant="outline" className="text-xs text-accent border-accent/40 shrink-0">{m.phase_name as string ?? '—'}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

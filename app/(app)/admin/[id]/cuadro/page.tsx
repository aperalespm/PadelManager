import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { getStandings } from '@/lib/actions/standings'
import { TournamentBracket } from '@/components/torneos/TournamentBracket'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminCuadroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const t = tournament as Record<string, unknown>
  const matches = await getMatchesForTournament(id) as Record<string, unknown>[]
  const format = t.format as string

  const showStandings = format === 'american' || format === 'groups_elimination'
  const standings = showStandings ? await getStandings(id) : []

  return (
    <div className="px-9 py-8 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground tracking-[-0.5px]">Cuadro del torneo</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t.name as string} · {(t.format as string)?.replace('_', ' ')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Vista jugador</Button>
          <Badge className="bg-[var(--success-surface)] text-[var(--success)] px-3 py-1.5">✓ Publicado</Badge>
        </div>
      </div>

      <div className="bg-[var(--accent-surface)] border border-accent/30 rounded-lg px-4 py-2.5 text-sm text-accent">
        💡 El cuadro se actualiza automáticamente cuando los jugadores validan resultados.
      </div>

      {matches.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">El cuadro se generará cuando cierres las inscripciones.</p>
        </div>
      ) : (
        <TournamentBracket matches={matches} mode="admin" />
      )}

      {/* ── Standings table for american / groups_elimination ── */}
      {showStandings && (
        <div className="bg-white border border-border rounded-[10px] overflow-hidden">
          <div className="px-[26px] py-[18px] border-b border-border">
            <h2 className="text-[15px] font-extrabold text-foreground tracking-[-0.3px]">Clasificación</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {format === 'american' ? 'Americano · todos contra todos' : 'Fase de grupos'}
            </p>
          </div>

          {standings.length === 0 ? (
            <div className="px-[26px] py-8 text-center">
              <p className="text-[13px] text-muted-foreground">Aún no hay partidos finalizados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-[var(--muted)]">
                    <th className="text-left px-4 py-[10px] text-[10px] font-bold uppercase tracking-[0.9px] text-light w-10">Pos</th>
                    <th className="text-left px-4 py-[10px] text-[10px] font-bold uppercase tracking-[0.9px] text-light">Pareja</th>
                    <th className="text-center px-3 py-[10px] text-[10px] font-bold uppercase tracking-[0.9px] text-light w-12">PJ</th>
                    <th className="text-center px-3 py-[10px] text-[10px] font-bold uppercase tracking-[0.9px] text-light w-12">PG</th>
                    <th className="text-center px-3 py-[10px] text-[10px] font-bold uppercase tracking-[0.9px] text-light w-12">PP</th>
                    <th className="text-center px-3 py-[10px] text-[10px] font-bold uppercase tracking-[0.9px] text-light w-24">Sets (+/-)</th>
                    <th className="text-center px-3 py-[10px] text-[10px] font-bold uppercase tracking-[0.9px] text-light w-24">Juegos (+/-)</th>
                    <th className="text-center px-3 py-[10px] text-[10px] font-bold uppercase tracking-[0.9px] text-light w-14">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, idx) => (
                    <tr
                      key={row.registration_id}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-[var(--muted)]'}
                    >
                      <td className="px-4 py-[10px] text-center">
                        <span className={
                          idx === 0
                            ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-[11px] font-bold'
                            : idx === 1
                            ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--muted)] border border-border text-[11px] font-semibold text-foreground'
                            : 'inline-flex items-center justify-center w-6 h-6 text-[12px] font-semibold text-muted-foreground'
                        }>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-[10px]">
                        <div className="font-semibold text-foreground">{row.player1_name || '—'}</div>
                        <div className="text-[11px] text-muted-foreground">{row.player2_name || ''}</div>
                      </td>
                      <td className="px-3 py-[10px] text-center text-muted-foreground">{row.played}</td>
                      <td className="px-3 py-[10px] text-center font-semibold text-[var(--success)]">{row.won}</td>
                      <td className="px-3 py-[10px] text-center text-muted-foreground">{row.lost}</td>
                      <td className="px-3 py-[10px] text-center text-muted-foreground">
                        {row.sets_won}/{row.sets_lost}
                        <span className={
                          row.sets_won - row.sets_lost > 0 ? ' text-[var(--success)] font-semibold' :
                          row.sets_won - row.sets_lost < 0 ? ' text-[var(--error)]' : ''
                        }>
                          {' '}({row.sets_won - row.sets_lost > 0 ? '+' : ''}{row.sets_won - row.sets_lost})
                        </span>
                      </td>
                      <td className="px-3 py-[10px] text-center text-muted-foreground">
                        {row.games_won}/{row.games_lost}
                        <span className={
                          row.games_won - row.games_lost > 0 ? ' text-[var(--success)] font-semibold' :
                          row.games_won - row.games_lost < 0 ? ' text-[var(--error)]' : ''
                        }>
                          {' '}({row.games_won - row.games_lost > 0 ? '+' : ''}{row.games_won - row.games_lost})
                        </span>
                      </td>
                      <td className="px-3 py-[10px] text-center font-bold text-foreground">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

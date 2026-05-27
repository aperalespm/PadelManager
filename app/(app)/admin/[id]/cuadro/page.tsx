import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
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

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cuadro del torneo</h1>
          <p className="text-sm text-muted-foreground">
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
    </div>
  )
}

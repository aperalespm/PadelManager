import { getMyActiveMatch } from '@/lib/actions/registrations'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { BottomNav } from '@/components/layout/BottomNav'
import { TournamentBracket } from '@/components/torneos/TournamentBracket'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

export const dynamic = 'force-dynamic'

export default async function CuadroPage() {
  const matchResult = await getMyActiveMatch()
  const activeMatch = 'data' in matchResult ? matchResult.data : null

  if (!activeMatch) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">Cuadro</h1>
        </header>
        <main className="max-w-md mx-auto px-4 py-4">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sin torneo activo</EmptyTitle>
              <EmptyDescription>Inscríbete en un torneo para ver el cuadro.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </main>
        <BottomNav />
      </div>
    )
  }

  const matches = await getMatchesForTournament((activeMatch as Record<string, unknown>).tournament_id as string)
  const myRegId = (activeMatch as Record<string, unknown>).team1_reg_id as string ?? (activeMatch as Record<string, unknown>).team2_reg_id as string

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">{(activeMatch as Record<string, unknown>).tournament_name as string}</p>
        <h1 className="text-lg font-bold text-foreground">Cuadro</h1>
      </header>
      <main className="px-4 py-4 overflow-x-auto">
        <TournamentBracket matches={matches as Record<string, unknown>[]} highlightRegId={myRegId} mode="player" />
      </main>
      <BottomNav />
    </div>
  )
}

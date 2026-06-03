import { getMyActiveMatch } from '@/lib/actions/registrations'
import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { BottomNav } from '@/components/layout/BottomNav'
import { MiTorneoTabs } from '@/components/torneos/MiTorneoTabs'

export const dynamic = 'force-dynamic'

export default async function MiTorneoPage() {
  const matchResult = await getMyActiveMatch()
  const match = 'data' in matchResult ? matchResult.data as Record<string, unknown> | null : null

  let tournament: Record<string, unknown> | null = null
  let allMatches: Record<string, unknown>[] = []
  let myRegId = ''

  if (match) {
    const tournamentId = match.tournament_id as string
    const [t, m] = await Promise.all([
      getTournamentById(tournamentId),
      getMatchesForTournament(tournamentId),
    ])
    tournament = t as Record<string, unknown> | null
    allMatches = m as Record<string, unknown>[]
    myRegId = (match.team1_reg_id ?? match.team2_reg_id) as string ?? ''
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="max-w-md mx-auto">
          {tournament && <p className="text-xs text-muted-foreground">{tournament.name as string}</p>}
          <h1 className="text-lg font-bold text-foreground">Mi torneo</h1>
        </div>
      </header>

      <MiTorneoTabs
        match={match}
        tournament={tournament}
        allMatches={allMatches}
        myRegId={myRegId}
      />

      <BottomNav />
    </div>
  )
}

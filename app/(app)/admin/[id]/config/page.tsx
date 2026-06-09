import { getTournamentById, getAllTournamentsForSidebar } from '@/lib/actions/tournaments'
import { getMatchCountForTournament } from '@/lib/actions/matches'
import { notFound } from 'next/navigation'
import { TournamentConfigForm } from '@/components/admin/TournamentConfigForm'

export const dynamic = 'force-dynamic'

export default async function ConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [tournament, allTournaments, matchCount] = await Promise.all([
    getTournamentById(id),
    getAllTournamentsForSidebar(),
    getMatchCountForTournament(id),
  ])
  if (!tournament) notFound()

  const otherTournaments = allTournaments.filter(t => t.id !== id)

  return (
    <div className="h-full overflow-y-auto px-9 py-8">
      <TournamentConfigForm
        tournament={tournament as Record<string, unknown>}
        otherTournaments={otherTournaments}
        hasExistingMatches={matchCount > 0}
      />
    </div>
  )
}

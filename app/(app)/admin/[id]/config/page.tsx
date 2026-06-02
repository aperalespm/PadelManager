import { getTournamentById, getAllTournamentsForSidebar } from '@/lib/actions/tournaments'
import { notFound } from 'next/navigation'
import { TournamentConfigForm } from '@/components/admin/TournamentConfigForm'

export const dynamic = 'force-dynamic'

export default async function ConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [tournament, allTournaments] = await Promise.all([
    getTournamentById(id),
    getAllTournamentsForSidebar(),
  ])
  if (!tournament) notFound()

  const otherTournaments = allTournaments.filter(t => t.id !== id)

  return (
    <div className="px-9 py-8">
      <TournamentConfigForm tournament={tournament as Record<string, unknown>} otherTournaments={otherTournaments} />
    </div>
  )
}

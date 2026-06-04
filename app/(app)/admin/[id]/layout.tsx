import { getTournamentById, getAllTournamentsForSidebar } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/layout/AdminSidebar'

export const dynamic = 'force-dynamic'

export default async function AdminTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [tournament, allTournaments, matches] = await Promise.all([
    getTournamentById(id),
    getAllTournamentsForSidebar(),
    getMatchesForTournament(id),
  ])
  if (!tournament) redirect('/admin')

  const t = tournament as Record<string, unknown>
  const activeMatchCount = (matches as Record<string, unknown>[]).filter(m => m.status === 'active' || m.status === 'disputed').length

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        tournamentId={id}
        tournamentName={t.name as string}
        tournamentStatus={t.status as string}
        organizerName="Alejandro R."
        activeMatchCount={activeMatchCount}
        tournaments={allTournaments}
      />
      <main className="flex-1 bg-background min-h-screen">
        {children}
      </main>
    </div>
  )
}

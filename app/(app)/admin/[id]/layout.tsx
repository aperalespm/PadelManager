import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { notFound } from 'next/navigation'
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
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const t = tournament as Record<string, unknown>
  const matches = await getMatchesForTournament(id) as Record<string, unknown>[]
  const activeMatchCount = matches.filter(m => m.status === 'active' || m.status === 'disputed').length

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        tournamentId={id}
        tournamentName={t.name as string}
        tournamentStatus={t.status as string}
        organizerName="Alejandro R."
        activeMatchCount={activeMatchCount}
      />
      <main className="flex-1 bg-background overflow-auto">
        {children}
      </main>
    </div>
  )
}

import { getTournamentById } from '@/lib/actions/tournaments'
import { notFound } from 'next/navigation'
import { TournamentConfigForm } from '@/components/admin/TournamentConfigForm'

export const dynamic = 'force-dynamic'

export default async function ConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  return (
    <div className="p-6">
      <TournamentConfigForm tournament={tournament as Record<string, unknown>} />
    </div>
  )
}

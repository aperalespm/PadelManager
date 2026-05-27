import { auth } from '@/lib/auth'
import { getRegistrations } from '@/lib/actions/registrations'
import { confirmRegistration, promoteFromWaitlist } from '@/lib/actions/registrations'
import { getTournamentById, closeTournamentRegistrations } from '@/lib/actions/tournaments'
import { generateBracket } from '@/lib/actions/bracket'
import { RegistrationTable } from '@/components/admin/RegistrationTable'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function InscritosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const result = await getRegistrations(id)
  const registrations = 'data' in result ? result.data ?? [] : []

  return (
    <div className="p-6">
      <RegistrationTable
        tournamentId={id}
        tournament={tournament as Record<string, unknown>}
        registrations={registrations as Record<string, unknown>[]}
      />
    </div>
  )
}

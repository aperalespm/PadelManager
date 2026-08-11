import { getTournamentById } from '@/lib/actions/tournaments'
import { redirect, notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LegacyInscripcionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()
  redirect(`/${tournament.share_slug as string}/inscripcion`)
}

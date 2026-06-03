import { getMyTournaments } from '@/lib/actions/tournaments'
import { redirect } from 'next/navigation'
import { createDraftTournament } from '@/lib/actions/tournaments'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const result = await getMyTournaments()
  const tournaments = 'data' in result ? result.data ?? [] : []

  if (tournaments.length > 0) {
    const first = tournaments[0] as Record<string, unknown>
    redirect(`/admin/${first.id as string}`)
  }

  // No tournaments yet — create a draft and redirect there
  const created = await createDraftTournament()
  if (created.data) {
    redirect(`/admin/${created.data.id}/config`)
  }

  // Fallback (should not reach here)
  redirect('/admin/nuevo')
}

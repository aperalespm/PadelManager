import { getTournamentById } from '@/lib/actions/tournaments'
import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import { EmailComposer } from '@/components/admin/EmailComposer'

export const dynamic = 'force-dynamic'

type RawCategory = { name: string; genders?: string[] }

function expandCategoryNames(cats: RawCategory[]): string[] {
  const result: string[] = []
  for (const cat of cats) {
    if (!cat.name?.trim()) continue
    if (!cat.genders || cat.genders.length === 0) {
      result.push(cat.name)
    } else {
      for (const g of cat.genders) {
        const suffix = g === 'masculino' ? ' Masculino' : g === 'femenino' ? ' Femenino' : ' Mixto'
        result.push(cat.name + suffix)
      }
    }
  }
  return result
}

async function getRecipientCounts(tournamentId: string): Promise<Record<string, number>> {
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE form_data->>'email' IS NOT NULL AND form_data->>'email' != '')::int AS all,
      COUNT(*) FILTER (WHERE status = 'confirmed' AND form_data->>'email' IS NOT NULL AND form_data->>'email' != '')::int AS confirmed,
      COUNT(*) FILTER (WHERE status = 'pending' AND form_data->>'email' IS NOT NULL AND form_data->>'email' != '')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'waitlist' AND form_data->>'email' IS NOT NULL AND form_data->>'email' != '')::int AS waitlist
    FROM registrations
    WHERE tournament_id = ${tournamentId}
  `
  return rows[0] ?? { all: 0, confirmed: 0, pending: 0, waitlist: 0 }
}

export default async function EmailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const t = tournament as Record<string, unknown>
  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const rawCats = (vd.categories as RawCategory[]) ?? []
  const categoryOptions = expandCategoryNames(rawCats)

  const recipientCounts = await getRecipientCounts(id)

  return (
    <div className="h-full overflow-y-auto px-6 md:px-9 py-8">
      <EmailComposer
        tournamentId={id}
        tournamentName={t.name as string}
        categoryOptions={categoryOptions}
        recipientCounts={recipientCounts}
      />
    </div>
  )
}

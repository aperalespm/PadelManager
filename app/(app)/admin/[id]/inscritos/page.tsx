import { getRegistrations } from '@/lib/actions/registrations'
import { getTournamentById } from '@/lib/actions/tournaments'
import { RegistrationTable } from '@/components/admin/RegistrationTable'
import { notFound } from 'next/navigation'

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

export default async function InscritosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const result = await getRegistrations(id)
  const registrations = 'data' in result ? result.data ?? [] : []

  const vd = (tournament.venue_details as Record<string, unknown>) ?? {}
  const rawCats = (vd.categories as RawCategory[]) ?? []
  const categoryOptions = expandCategoryNames(rawCats)

  return (
    <div className="h-full overflow-y-auto px-9 py-8">
      <RegistrationTable
        tournamentId={id}
        tournament={tournament as Record<string, unknown>}
        registrations={registrations as Record<string, unknown>[]}
        categoryOptions={categoryOptions}
      />
    </div>
  )
}

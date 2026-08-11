import { getTournamentBySlug } from '@/lib/actions/tournaments'
import { notFound } from 'next/navigation'
import { RegistrationForm } from '@/components/torneos/RegistrationForm'
import { RegistrationCloseButton } from '@/components/torneos/RegistrationCloseButton'

export const dynamic = 'force-dynamic'

export default async function InscripcionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tournament = await getTournamentBySlug(slug)
  if (!tournament) notFound()

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{tournament.name as string}</p>
            <h1 className="text-lg font-bold text-foreground">Inscripción</h1>
          </div>
          <RegistrationCloseButton slug={slug} />
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-4">
        <RegistrationForm tournament={tournament} userId="" />
      </div>
    </div>
  )
}

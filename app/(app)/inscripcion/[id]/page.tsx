import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTournamentById } from '@/lib/actions/tournaments'
import { notFound } from 'next/navigation'
import { RegistrationForm } from '@/components/torneos/RegistrationForm'

export const dynamic = 'force-dynamic'

export default async function InscripcionPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/login')

  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto">
          <p className="text-xs text-muted-foreground">{tournament.name as string}</p>
          <h1 className="text-lg font-bold text-foreground">Inscripción</h1>
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-4">
        <RegistrationForm tournament={tournament} userId={session.user.id} />
      </div>
    </div>
  )
}

import { TournamentCreateForm } from '@/components/admin/TournamentCreateForm'

export const dynamic = 'force-dynamic'

export default function NuevoTorneoPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground">Crear torneo</h1>
          <p className="text-sm text-muted-foreground">Configura los datos de tu nuevo torneo</p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-6">
        <TournamentCreateForm />
      </main>
    </div>
  )
}

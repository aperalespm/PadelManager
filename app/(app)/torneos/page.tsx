import { getTournaments } from '@/lib/actions/tournaments'
import { TournamentCard } from '@/components/torneos/TournamentCard'
import { TournamentFilters } from '@/components/torneos/TournamentFilters'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { BottomNav } from '@/components/layout/BottomNav'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TorneosPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; search?: string }>
}) {
  const params = await searchParams
  const result = await getTournaments(params)
  const tournaments = Array.isArray(result) ? result : []

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">PadelManager</h1>
          <Link href="/login" className="text-sm text-accent font-medium">Entrar</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
        <TournamentFilters />

        {tournaments.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No hay torneos disponibles</EmptyTitle>
              <EmptyDescription>Aún no hay torneos publicados. Vuelve pronto.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {tournaments.map((t: Record<string, unknown>) => (
              <TournamentCard key={t.id as string} tournament={t} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getMyActiveMatch } from '@/lib/actions/registrations'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { BottomNav } from '@/components/layout/BottomNav'
import { MyMatchCard } from '@/components/torneos/MyMatchCard'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function MiTorneoPage() {
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/login')

  const result = await getMyActiveMatch()
  const match = 'data' in result ? result.data : null

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="max-w-md mx-auto">
          {match ? <p className="text-xs text-muted-foreground">{(match as Record<string, unknown>).tournament_name as string}</p> : null}
          <h1 className="text-lg font-bold text-foreground">Mi partido</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        {!match ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No estás en ningún torneo activo</EmptyTitle>
              <EmptyDescription>Inscríbete en un torneo desde la sección Explorar.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/torneos" className="text-sm text-accent underline">Ver torneos</Link>
            </EmptyContent>
          </Empty>
        ) : (
          <MyMatchCard match={match as Record<string, unknown>} userId={session.user.id} />
        )}
      </main>

      <BottomNav />
    </div>
  )
}

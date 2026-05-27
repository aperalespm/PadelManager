import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTournamentById } from '@/lib/actions/tournaments'
import { notFound } from 'next/navigation'
import { AdminSidebar } from '@/components/layout/AdminSidebar'

export const dynamic = 'force-dynamic'

export default async function AdminTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/login')

  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  if ((tournament as Record<string, unknown>).organizer_id !== session.user.id) {
    redirect('/admin')
  }

  const t = tournament as Record<string, unknown>

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        tournamentId={id}
        tournamentName={t.name as string}
        tournamentStatus={t.status as string}
        organizerName={session.user.name ?? session.user.email ?? 'Organizador'}
      />
      <main className="flex-1 bg-background overflow-auto">
        {children}
      </main>
    </div>
  )
}

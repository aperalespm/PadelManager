import { getMyTournaments, createDraftTournament } from '@/lib/actions/tournaments'
import { redirect } from 'next/navigation'
import { CreateTournamentButton } from '@/components/admin/CreateTournamentButton'
import { AdminUserMenu } from '@/components/admin/AdminUserMenu'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const [result, { data: session }] = await Promise.all([
    getMyTournaments(),
    auth.getSession(),
  ])
  const tournaments = 'data' in result ? result.data ?? [] : []

  if (tournaments.length > 0) {
    const first = tournaments[0] as Record<string, unknown>
    redirect(`/admin/${first.id as string}`)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <span className="font-bold text-foreground">JoyPadel Admin</span>
        <AdminUserMenu
          email={session?.user?.email ?? ''}
          name={session?.user?.name}
        />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-[48px]">🎾</div>
        <h1 className="text-[22px] font-extrabold text-foreground tracking-[-0.5px]">Ningún torneo todavía</h1>
        <p className="text-[14px] text-muted-foreground text-center max-w-xs">
          Crea tu primer torneo para empezar a gestionar inscripciones, cuadros y partidos.
        </p>
        <CreateTournamentButton />
      </div>
    </div>
  )
}

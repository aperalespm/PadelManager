import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPublicProfile } from '@/lib/actions/profile'
import { PlayerProfile } from '@/components/profile/PlayerProfile'
import { BottomNav } from '@/components/layout/BottomNav'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/login')

  const result = await getPublicProfile(session.user.id)
  const data = 'data' in result ? result.data : null

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Mi perfil</h1>
      </header>
      <main className="max-w-md mx-auto px-4 py-4">
        {data && (
          <PlayerProfile
            profile={data.profile as Record<string, unknown>}
            tournaments={data.tournaments as Record<string, unknown>[]}
            stats={data.stats as Record<string, unknown>}
            isOwn={true}
          />
        )}
      </main>
      <BottomNav />
    </div>
  )
}

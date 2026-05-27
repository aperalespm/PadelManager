import { getPublicProfile } from '@/lib/actions/profile'
import { PlayerProfile } from '@/components/profile/PlayerProfile'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PublicPerfilPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const result = await getPublicProfile(userId)
  if ('error' in result) notFound()

  const { data } = result

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="max-w-md mx-auto px-4 py-4">
        <PlayerProfile
          profile={data.profile as Record<string, unknown>}
          tournaments={data.tournaments as Record<string, unknown>[]}
          stats={data.stats as Record<string, unknown>}
          isOwn={false}
        />
      </div>
    </div>
  )
}

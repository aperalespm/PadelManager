import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { notFound } from 'next/navigation'
import { VivoClient, ClientMatch } from '@/components/admin/VivoClient'

export const dynamic = 'force-dynamic'

export default async function EnVivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const t = tournament as Record<string, unknown>
  const vd = (t.venue_details as Record<string, unknown>) ?? {}

  const rawMatches = await getMatchesForTournament(id) as Record<string, unknown>[]

  const matches: ClientMatch[] = rawMatches.map(m => {
    const t1p1 = (m.t1p1_name as string | null) ?? null
    const t1p2 = (m.t1p2_name_display as string | null) ?? null
    const t2p1 = (m.t2p1_name as string | null) ?? null
    const t2p2 = (m.t2p2_name_display as string | null) ?? null

    const t1Name = t1p1 ? (t1p2 ? `${t1p1} / ${t1p2}` : t1p1) : 'Equipo 1'
    const t2Name = t2p1 ? (t2p2 ? `${t2p1} / ${t2p2}` : t2p1) : 'Equipo 2'

    return {
      id: m.id as string,
      team1RegId: (m.team1_reg_id as string | null) ?? null,
      team2RegId: (m.team2_reg_id as string | null) ?? null,
      winnerRegId: (m.winner_reg_id as string | null) ?? null,
      t1Name,
      t2Name,
      courtName: (m.court_name as string) ?? 'Pista',
      scheduledAt: m.scheduled_at ? new Date(m.scheduled_at as string).toISOString() : null,
      phaseName: (m.phase_name as string) ?? '',
      round: (m.round as number) ?? 1,
      matchNumber: (m.match_number as number) ?? 1,
      groupLabel: (m.group_label as string | null) ?? null,
      categoryLabel: (m.category_label as string | null) ?? null,
      status: (m.status as string) ?? 'pending',
      finalScore: (m.final_score as Array<{ vosotros: number; rival: number }> | null) ?? null,
    }
  })

  return (
    <VivoClient
      matches={matches}
      tournamentId={id}
      tournamentName={t.name as string}
      scoringSystem={(vd.scoring_system as string) ?? 'WIN_LOSS'}
      tiebreakCriteria={(vd.tiebreak_criteria as string[]) ?? ['SET_DIFFERENCE', 'GAME_DIFFERENCE', 'RANDOM']}
      teamsAdvancingPerGroup={(vd.teams_advancing_per_group as number) ?? 2}
    />
  )
}

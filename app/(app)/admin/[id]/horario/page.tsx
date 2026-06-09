import { getTournamentById } from '@/lib/actions/tournaments'
import { loadScheduleChat } from '@/lib/actions/schedule-agent'
import { getConfirmedPairsForSchedule } from '@/lib/actions/registrations'
import { ScheduleAgent } from '@/components/schedule/ScheduleAgent'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function HorarioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params
  const sp = await searchParams
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const [chatResult, registeredPairs] = await Promise.all([
    loadScheduleChat(id),
    getConfirmedPairsForSchedule(id),
  ])
  const initialData = 'data' in chatResult ? chatResult.data : { messages: [], schedule: null, version: 0, isPublished: false, scheduleUpdatedAt: null, versionHistory: [], lastRegistrationAt: null }

  const vd = (tournament.venue_details as Record<string, unknown>) ?? {}
  const schedule = (vd.schedule as Record<string, unknown>) ?? {}
  const courts = (vd.courts as Array<{ name: string; type?: string }>) ?? []
  const categories = (vd.categories as Array<{ name: string; minScore?: string; maxScore?: string; genders?: string[] }>) ?? []
  const phases = (vd.phases as Array<{ name: string; match_config?: Record<string, unknown> }>) ?? []
  const timeBlocks = (schedule.time_blocks as Array<{ id: string; courtName: string; from: string; to: string; reason: string }>) ?? []

  const tournamentConfig = {
    tournamentId: id,
    name: tournament.name as string,
    courts: courts.map((c, i) => ({
      id: String(i + 1),
      courtNumber: i + 1,
      name: c.name,
      breaks: timeBlocks
        .filter(b => b.courtName === c.name)
        .map(b => ({ start: b.from, end: b.to })),
    })),
    schedule: {
      startTime: (schedule.start_time as string) ?? '10:00',
      endTime: (schedule.end_time as string) ?? '21:00',
      transitionMins: (schedule.transition_minutes as number) ?? 0,
      lunchBreak: schedule.lunch_break ?? null,
    },
    categories: categories.flatMap(c => {
      const genders = (c.genders as string[]) ?? []
      if (genders.length === 0) return [{ id: c.name, name: c.name, minScore: c.minScore, maxScore: c.maxScore }]
      return genders.map(g => ({
        id: `${c.name}_${g}`,
        name: `${c.name} ${g === 'M' ? 'Masculino' : g === 'F' ? 'Femenino' : 'Mixto'}`,
        minScore: c.minScore,
        maxScore: c.maxScore,
      }))
    }),
    phases: phases.map(p => ({
      name: p.name,
      maxDurationMins: (p.match_config?.time_limit_minutes as number) ?? 60,
    })),
    format: {
      numGroups: (vd.num_groups as number) ?? 3,
      teamsPerGroup: (vd.teams_per_group as number) ?? 4,
      teamsAdvancePerGroup: (vd.teams_advance_per_group as number) ?? 2,
      minMatchesPerTeam: (vd.min_matches_per_team as number) ?? 3,
    },
    tournamentStatus: (tournament.status as string) ?? 'draft',
    registeredPairs: registeredPairs.length > 0 ? registeredPairs : undefined,
  }

  const tournamentUpdatedAt = tournament.updated_at ? String(tournament.updated_at) : null
  const scheduleUpdatedAt = initialData.scheduleUpdatedAt ?? null
  const lastRegistrationAt = initialData.lastRegistrationAt ?? null

  return (
    <ScheduleAgent
      tournamentId={id}
      tournamentName={tournament.name as string}
      tournamentConfig={tournamentConfig}
      initialMessages={initialData.messages}
      initialSchedule={initialData.schedule}
      initialIsPublished={initialData.isPublished}
      initialVersion={initialData.version}
      initialVersionHistory={initialData.versionHistory}
      autoRegenerate={sp.regenerate === '1'}
      tournamentUpdatedAt={tournamentUpdatedAt}
      scheduleUpdatedAt={scheduleUpdatedAt}
      lastRegistrationAt={lastRegistrationAt}
    />
  )
}

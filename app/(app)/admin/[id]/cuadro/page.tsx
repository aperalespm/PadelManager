import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { getGroupBracketData } from '@/lib/actions/bracket'
import { TournamentBracket } from '@/components/torneos/TournamentBracket'
import { GroupBracketView } from '@/components/torneos/GroupBracketView'
import { GenerateBracketButton } from '@/components/torneos/GenerateBracketButton'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminCuadroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const t = tournament as Record<string, unknown>
  const format = t.format as string
  const isGroupsElim = format === 'groups_elimination'

  const matches = await getMatchesForTournament(id) as Record<string, unknown>[]

  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const numGroups = Math.max(1, parseInt(String(vd.num_groups ?? '3')) || 3)
  const teamsAdvancePerGroup = Math.max(1, parseInt(String(vd.teams_advance_per_group ?? '2')) || 2)

  const groupBracketResult = isGroupsElim && matches.length > 0
    ? await getGroupBracketData(id)
    : null
  const catMap = groupBracketResult?.data ?? null

  return (
    <div className="px-9 py-8 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground tracking-[-0.5px]">Cuadro del torneo</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t.name as string} · {format?.replace('_', ' ')}
          </p>
        </div>
        <div className="flex gap-2">
          {isGroupsElim && matches.length === 0 && (
            <GenerateBracketButton tournamentId={id} />
          )}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center flex flex-col items-center gap-3">
          {isGroupsElim ? (
            <>
              <p className="text-foreground font-semibold">Cuadro no generado</p>
              <p className="text-[13px] text-muted-foreground max-w-md">
                Pulsa "Generar cuadro" para asignar las parejas confirmadas a los grupos y crear los partidos de la fase de grupos.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">El cuadro se generará cuando cierres las inscripciones.</p>
          )}
        </div>
      ) : isGroupsElim && catMap ? (
        <>
          <div className="bg-[var(--accent-surface)] border border-accent/30 rounded-lg px-4 py-2.5 text-sm text-accent">
            💡 El cuadro se actualiza automáticamente cuando los jugadores validan resultados.
          </div>
          <div className="bg-card border border-border rounded-xl p-6 w-full">
            <GroupBracketView
              catMap={catMap}
              numGroups={numGroups}
              teamsAdvancePerGroup={teamsAdvancePerGroup}
            />
          </div>
        </>
      ) : (
        <>
          <div className="bg-[var(--accent-surface)] border border-accent/30 rounded-lg px-4 py-2.5 text-sm text-accent">
            💡 El cuadro se actualiza automáticamente cuando los jugadores validan resultados.
          </div>
          <TournamentBracket matches={matches} mode="admin" />
        </>
      )}
    </div>
  )
}

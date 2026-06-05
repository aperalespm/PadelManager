import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { getGroupBracketData, getGroupBracketDraftData } from '@/lib/actions/bracket'
import { getRegistrationCountsByCategory } from '@/lib/actions/registrations'
import { loadScheduleChat } from '@/lib/actions/schedule-agent'
import { TournamentBracket } from '@/components/torneos/TournamentBracket'
import { GroupBracketView } from '@/components/torneos/GroupBracketView'
import { GenerateBracketButton } from '@/components/torneos/GenerateBracketButton'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

function expandCategoryNames(cats: Array<{ name: string; genders?: string[] }>): string[] {
  const result: string[] = []
  for (const cat of cats) {
    if (!cat.name?.trim()) continue
    if (!cat.genders || cat.genders.length === 0) {
      result.push(cat.name)
    } else {
      for (const g of cat.genders) {
        const suffix = g === 'masculino' ? ' Masculino' : g === 'femenino' ? ' Femenino' : ' Mixto'
        result.push(cat.name + suffix)
      }
    }
  }
  return result
}

export default async function AdminCuadroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const t = tournament as Record<string, unknown>
  const format = t.format as string
  const isGroupsElim = format === 'groups_elimination'

  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const numGroups = Math.max(1, parseInt(String(vd.num_groups ?? '3')) || 3)
  const teamsPerGroup = Math.max(1, parseInt(String(vd.teams_per_group ?? '4')) || 4)
  const teamsAdvancePerGroup = Math.max(1, parseInt(String(vd.teams_advance_per_group ?? '2')) || 2)
  const capacityPerCategory = numGroups * teamsPerGroup

  const rawCats = (vd.categories as Array<{ name: string; genders?: string[] }>) ?? []
  const categoryNames = expandCategoryNames(rawCats)

  const [matches, regCounts, scheduleResult] = await Promise.all([
    getMatchesForTournament(id) as Promise<Record<string, unknown>[]>,
    getRegistrationCountsByCategory(id),
    loadScheduleChat(id),
  ])

  const isSchedulePublished = 'data' in scheduleResult ? scheduleResult.data.isPublished : false

  const hasMatches = matches.length > 0

  const groupBracketResult = isGroupsElim && hasMatches
    ? await getGroupBracketData(id)
    : null
  const catMap = groupBracketResult?.data ?? null

  // Draft data: shown when no matches yet (slots with confirmed pairs + placeholders)
  const draftDataResult = isGroupsElim && !hasMatches
    ? await getGroupBracketDraftData(id)
    : null
  const draftCatMap = draftDataResult?.data ?? null

  // Build fill data — configured categories first, then any uncategorised
  const fillData = categoryNames.length > 0
    ? categoryNames.map(name => {
        const row = regCounts.find(r => r.category === name)
        return { name, confirmed: row?.confirmed ?? 0, pending: row?.pending ?? 0, capacity: capacityPerCategory }
      })
    : regCounts.map(r => ({
        name: r.category || 'Sin categoría',
        confirmed: r.confirmed,
        pending: r.pending,
        capacity: capacityPerCategory,
      }))

  const totalConfirmed = fillData.reduce((s, c) => s + c.confirmed, 0)
  const totalCapacity  = fillData.reduce((s, c) => s + c.capacity, 0)

  return (
    <div className="px-9 py-8 flex flex-col gap-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground tracking-[-0.5px]">Cuadro del torneo</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t.name as string} · {format?.replace('_', ' ')}
          </p>
        </div>
        {isGroupsElim && (
          <GenerateBracketButton
            tournamentId={id}
            hasMatches={hasMatches}
            schedulePublished={isSchedulePublished}
          />
        )}
      </div>

      {/* ── Category fill strip ─────────────────────────────────────────── */}
      {fillData.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2.5 bg-card border border-border rounded-lg">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mr-1">
            Inscripciones
          </span>
          {fillData.map(cat => {
            const pct      = cat.capacity > 0 ? cat.confirmed / cat.capacity : 0
            const isFull   = cat.confirmed >= cat.capacity
            const isHalf   = pct >= 0.5

            const dotCls  = isFull ? 'bg-[var(--success)]' : isHalf ? 'bg-accent' : 'bg-[var(--warning)]'
            const textCls = isFull ? 'text-[var(--success)]' : isHalf ? 'text-accent' : 'text-[var(--warning)]'
            const bgCls   = isFull
              ? 'bg-[var(--success-surface)] border-[var(--success)]/25'
              : isHalf
              ? 'bg-[var(--accent-surface)] border-accent/25'
              : 'bg-[var(--warning-surface)] border-[var(--warning)]/25'

            return (
              <span
                key={cat.name}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-medium ${bgCls} ${textCls}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
                {cat.name}
                <span className="font-bold">{cat.confirmed}/{cat.capacity}</span>
                {cat.pending > 0 && (
                  <span className="text-[10px] opacity-70">(+{cat.pending})</span>
                )}
              </span>
            )
          })}
          <span className="text-[11px] text-muted-foreground ml-1">
            · {totalConfirmed}/{totalCapacity} total
          </span>
        </div>
      )}

      {/* ── Bracket ─────────────────────────────────────────────────────── */}
      {isGroupsElim && !hasMatches && draftCatMap ? (
        <>
          <div className="bg-muted/60 border border-border rounded-lg px-4 py-2.5 text-[13px] text-muted-foreground">
            Vista previa — Los grupos se rellenan con los inscritos confirmados. Pulsa &quot;Generar cuadro&quot; para crear los partidos.
          </div>
          <div className="bg-card border border-border rounded-xl p-6 w-full">
            <GroupBracketView
              catMap={draftCatMap}
              numGroups={numGroups}
              teamsAdvancePerGroup={teamsAdvancePerGroup}
              isDraft
            />
          </div>
        </>
      ) : !hasMatches ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center flex flex-col items-center gap-3">
          <p className="text-muted-foreground">El cuadro se generará cuando cierres las inscripciones.</p>
        </div>
      ) : isGroupsElim && catMap ? (
        <>
          <div className="bg-[var(--accent-surface)] border border-accent/30 rounded-lg px-4 py-2.5 text-sm text-accent">
            El cuadro se actualiza automáticamente cuando los jugadores validan resultados.
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
            El cuadro se actualiza automáticamente cuando los jugadores validan resultados.
          </div>
          <TournamentBracket matches={matches} mode="admin" />
        </>
      )}
    </div>
  )
}

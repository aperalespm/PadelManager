import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { getGroupBracketData } from '@/lib/actions/bracket'
import { getRegistrationCountsByCategory } from '@/lib/actions/registrations'
import { TournamentBracket } from '@/components/torneos/TournamentBracket'
import { GroupBracketView } from '@/components/torneos/GroupBracketView'
import { GenerateBracketButton } from '@/components/torneos/GenerateBracketButton'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Mirrors expandCategories from TournamentConfigForm — keeps names in sync.
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
  const status = t.status as string
  const isGroupsElim = format === 'groups_elimination'

  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const numGroups = Math.max(1, parseInt(String(vd.num_groups ?? '3')) || 3)
  const teamsPerGroup = Math.max(1, parseInt(String(vd.teams_per_group ?? '4')) || 4)
  const teamsAdvancePerGroup = Math.max(1, parseInt(String(vd.teams_advance_per_group ?? '2')) || 2)
  const capacityPerCategory = numGroups * teamsPerGroup

  const rawCats = (vd.categories as Array<{ name: string; genders?: string[] }>) ?? []
  const categoryNames = expandCategoryNames(rawCats)

  const [matches, regCounts] = await Promise.all([
    getMatchesForTournament(id) as Promise<Record<string, unknown>[]>,
    status === 'open' ? getRegistrationCountsByCategory(id) : Promise.resolve([]),
  ])

  const groupBracketResult = isGroupsElim && matches.length > 0
    ? await getGroupBracketData(id)
    : null
  const catMap = groupBracketResult?.data ?? null

  // Build per-category fill data. Categories with no registrations still appear if configured.
  const fillData = categoryNames.length > 0
    ? categoryNames.map(name => {
        const row = regCounts.find(r => r.category === name)
        return {
          name,
          confirmed: row?.confirmed ?? 0,
          pending: row?.pending ?? 0,
          capacity: capacityPerCategory,
        }
      })
    : regCounts.map(r => ({
        name: r.category || 'Sin categoría',
        confirmed: r.confirmed,
        pending: r.pending,
        capacity: capacityPerCategory,
      }))

  const showFillStatus = status === 'open' && fillData.length > 0
  const totalConfirmed = fillData.reduce((s, c) => s + c.confirmed, 0)
  const totalCapacity = fillData.reduce((s, c) => s + c.capacity, 0)

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

      {/* ── Category fill status (open registration phase) ─────────────── */}
      {showFillStatus && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-bold text-foreground">Inscripciones por categoría</h2>
            <span className="text-[12px] text-muted-foreground">
              {totalConfirmed} / {totalCapacity} plazas confirmadas
            </span>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {fillData.map(cat => {
              const pct = cat.capacity > 0 ? Math.min(1, cat.confirmed / cat.capacity) : 0
              const isFull = cat.confirmed >= cat.capacity
              const isHalfway = pct >= 0.5
              const remaining = Math.max(0, cat.capacity - cat.confirmed)

              const barColor = isFull
                ? 'bg-[var(--success)]'
                : isHalfway
                ? 'bg-accent'
                : 'bg-[var(--warning)]'

              const badgeColor = isFull
                ? 'bg-[var(--success-surface)] text-[var(--success)] border-[var(--success)]/30'
                : isHalfway
                ? 'bg-[var(--accent-surface)] text-accent border-accent/30'
                : 'bg-[var(--warning-surface)] text-[var(--warning)] border-[var(--warning)]/30'

              return (
                <div key={cat.name} className="flex flex-col gap-2 p-3 bg-background border border-border rounded-lg">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[13px] font-semibold text-foreground leading-tight">{cat.name}</span>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badgeColor}`}>
                      {isFull ? 'Completo' : `${remaining} libre${remaining !== 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {/* progress bar */}
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      <span className="font-semibold text-foreground">{cat.confirmed}</span> confirmadas
                      {cat.pending > 0 && (
                        <span className="ml-1.5 text-[var(--warning)]">+{cat.pending} pend.</span>
                      )}
                    </span>
                    <span>{cat.capacity} plazas</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Bracket ───────────────────────────────────────────────────────── */}
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

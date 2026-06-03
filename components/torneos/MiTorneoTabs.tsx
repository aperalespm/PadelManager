'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MyMatchCard } from '@/components/torneos/MyMatchCard'
import { TournamentBracket } from '@/components/torneos/TournamentBracket'
import Link from 'next/link'

type Tab = 'detalles' | 'partidas' | 'cuadro'

interface Props {
  match: Record<string, unknown> | null
  tournament: Record<string, unknown> | null
  allMatches: Record<string, unknown>[]
  myRegId: string
}

function formatDate(d: unknown) {
  if (!d) return '—'
  return new Date(d as string).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-3 border-b border-border last:border-0">
      <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[13px] font-medium text-foreground text-right">{value ?? '—'}</span>
    </div>
  )
}

const FORMAT_LABELS: Record<string, string> = {
  elimination: 'Eliminación directa',
  round_robin: 'Todos contra todos',
  groups_elimination: 'Grupos + eliminatoria',
  american: 'Americano',
}

export function MiTorneoTabs({ match, tournament, allMatches, myRegId }: Props) {
  const [tab, setTab] = useState<Tab>('partidas')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'detalles', label: 'Detalles' },
    { id: 'partidas', label: 'Partidas' },
    { id: 'cuadro',   label: 'Cuadro'   },
  ]

  return (
    <>
      {/* Sub-tab bar */}
      <div className="sticky top-[57px] z-30 bg-card border-b border-border">
        <div className="max-w-md mx-auto flex">
          {tabs.map(t => (
            <button key={t.id} type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 py-3 text-[13px] font-semibold transition-colors relative',
                tab === t.id ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
              )}>
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 py-4">

        {/* ── Detalles ─────────────────────────────────────────── */}
        {tab === 'detalles' && (
          !tournament ? (
            <EmptyState />
          ) : (
            <div className="bg-card border border-border rounded-[12px] overflow-hidden">
              <div className="px-4 py-3 bg-accent/5 border-b border-border">
                <p className="text-[15px] font-bold text-foreground">{tournament.name as string}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">{tournament.category as string}</p>
              </div>
              <div className="px-4">
                <DetailRow label="Inicio"       value={formatDate(tournament.start_date)} />
                <DetailRow label="Fin"          value={formatDate(tournament.end_date)} />
                <DetailRow label="Instalación"  value={String(tournament.venue_name ?? '—')} />
                <DetailRow label="Dirección"    value={String(tournament.venue_address ?? '—')} />
                <DetailRow label="Formato"      value={FORMAT_LABELS[tournament.format as string] ?? tournament.format as string} />
                <DetailRow label="Plazas"       value={`${tournament.confirmed_count as number ?? 0} / ${tournament.max_players as number}`} />
                {!!tournament.price_info && <DetailRow label="Precio" value={String(tournament.price_info)} />}
                {!!tournament.description && (
                  <div className="py-3">
                    <p className="text-[12px] text-muted-foreground mb-1">Descripción</p>
                    <p className="text-[13px] text-foreground leading-relaxed">{tournament.description as string}</p>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ── Partidas ─────────────────────────────────────────── */}
        {tab === 'partidas' && (
          !match ? (
            <EmptyState />
          ) : (
            <MyMatchCard match={match} userId="" />
          )
        )}

        {/* ── Cuadro ───────────────────────────────────────────── */}
        {tab === 'cuadro' && (
          allMatches.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <TournamentBracket matches={allMatches} highlightRegId={myRegId} mode="player" />
            </div>
          )
        )}

      </main>
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="text-[40px]">🎾</span>
      <p className="text-[15px] font-semibold text-foreground">No estás en ningún torneo activo</p>
      <p className="text-[13px] text-muted-foreground">Inscríbete en un torneo para ver esta información.</p>
      <Link href="/torneos" className="mt-2 text-[13px] text-accent font-semibold underline underline-offset-2">
        Ver torneos disponibles
      </Link>
    </div>
  )
}

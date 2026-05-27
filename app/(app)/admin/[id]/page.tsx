import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function StatCard({ value, label, className }: { value: number | string; label: string; className: string }) {
  return (
    <div className="bg-card rounded-xl p-6 shadow-sm">
      <p className={cn('text-5xl font-bold leading-none', className)}>{value}</p>
      <p className="text-sm text-muted-foreground mt-2">{label}</p>
    </div>
  )
}

export default async function AdminPanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournament = await getTournamentById(id)
  if (!tournament) notFound()

  const t = tournament as Record<string, unknown>
  const matches = await getMatchesForTournament(id) as Record<string, unknown>[]

  const activeMatches = matches.filter(m => m.status === 'active')
  const finishedMatches = matches.filter(m => m.status === 'finished')
  const disputedMatches = matches.filter(m => m.status === 'disputed')
  const confirmedCount = (t.confirmed_count as number) ?? 0

  const startDate = t.start_date
    ? new Date(t.start_date as string).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

  const statusLabel: Record<string, string> = {
    draft: 'Borrador', open: 'Abierto', active: 'En curso', finished: 'Finalizado',
  }

  const statusBadge: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    open: 'bg-accent text-accent-foreground',
    active: 'bg-[var(--warning)] text-[var(--warning-foreground)]',
    finished: 'bg-[var(--success-surface)] text-[var(--success)]',
  }

  return (
    <div className="p-8 flex flex-col gap-7 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.name as string} · {startDate}{t.venue_name ? ` · ${t.venue_name as string}` : ''}{t.venue_address ? ` · ${t.venue_address as string}` : ''}
          </p>
        </div>
        <Badge className={cn('text-sm px-3 py-1.5 shrink-0', statusBadge[t.status as string] ?? statusBadge.draft)}>
          {t.status === 'active' && '● '}
          {statusLabel[t.status as string] ?? (t.status as string)}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={confirmedCount} label="Parejas inscritas" className="text-accent" />
        <StatCard value={activeMatches.length} label="Partidos activos" className="text-[var(--warning)]" />
        <StatCard value={finishedMatches.length} label="Finalizados" className="text-[var(--success)]" />
        <StatCard value={disputedMatches.length} label="Disputas abiertas" className="text-[var(--error)]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tournament info */}
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">INFORMACIÓN DEL TORNEO</p>
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            {[
              { label: 'Formato', value: (t.format as string)?.replace('_', ' ') },
              { label: 'Instalación', value: t.venue_name ? `${t.venue_name}${t.venue_address ? ` — ${t.venue_address}` : ''}` : '—' },
              { label: 'Fecha', value: startDate },
              { label: 'Inscripción', value: (t.registration_type as string) === 'pair' ? 'Pareja' : 'Individual' },
              { label: 'Fase actual', value: 'Octavos de final' },
            ].map((row, i, arr) => (
              <div key={row.label} className={cn('flex justify-between px-5 py-3 text-sm', i < arr.length - 1 && 'border-b border-border')}>
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium text-foreground text-right max-w-xs capitalize">{row.value ?? '—'}</span>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">ACCIONES RÁPIDAS</p>
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/admin/${id}/inscritos`}>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-10">⊞ Ver inscritos</Button>
            </Link>
            <Link href={`/admin/${id}/cuadro`}>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-10">🏆 Ver cuadro</Button>
            </Link>
            <Link href={`/admin/${id}/vivo`}>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-10">▶ Monitorizar vivo</Button>
            </Link>
            <Link href={`/admin/${id}/config`}>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-10">⚙ Configuración</Button>
            </Link>
          </div>
        </div>

        {/* Active matches */}
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">PARTIDOS ACTIVOS AHORA</p>
          <div className="bg-card rounded-xl shadow-sm overflow-hidden flex flex-col">
            {activeMatches.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No hay partidos activos</p>
            ) : (
              <>
                {activeMatches.slice(0, 5).map((m, i, arr) => {
                  const time = m.scheduled_at
                    ? new Date(m.scheduled_at as string).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    : null
                  const score = m.final_score as Array<{ vosotros: number; rival: number }> | null
                  const scoreStr = score ? score.map(s => `${s.vosotros}–${s.rival}`).join(', ') : '—'

                  return (
                    <div key={m.id as string} className={cn('px-5 py-3.5 flex items-center border-l-4 border-l-[var(--warning)]', i < arr.length - 1 && 'border-b border-border')}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--warning)] uppercase tracking-wide">{m.court_name as string ?? 'Pista'}</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5 truncate">
                          {m.t1p1_name as string ?? 'Equipo 1'}{m.t1p2_name_display ? ` / ${m.t1p2_name_display as string}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.t2p1_name as string ?? 'Equipo 2'}{m.t2p2_name_display ? ` / ${m.t2p2_name_display as string}` : ''}
                        </p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="font-bold text-foreground text-sm">{scoreStr}</p>
                        {time && <p className="text-xs text-muted-foreground mt-0.5">⊙ {time}</p>}
                      </div>
                    </div>
                  )
                })}
                <div className="border-t border-border">
                  <Link href={`/admin/${id}/vivo`} className="flex items-center justify-center px-5 py-3 text-sm text-accent font-medium hover:bg-accent/5 transition-colors">
                    Ver todos los partidos →
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

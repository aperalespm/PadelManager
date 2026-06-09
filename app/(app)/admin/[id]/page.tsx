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
    <div className="bg-card border border-border rounded-[10px] py-[18px] px-5">
      <p className={cn('text-[28px] font-extrabold leading-none tracking-[-1px]', className)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</p>
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
    draft: 'bg-[#f1f5f9] text-light',
    open: 'bg-[var(--accent-surface)] text-accent',
    active: 'bg-[var(--warning-surface)] text-[var(--warning)]',
    finished: 'bg-[var(--success-surface)] text-[var(--success)]',
  }

  return (
    <div className="h-full overflow-y-auto px-9 py-8 flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground tracking-[-0.5px]">Panel</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t.name as string} · {startDate}{t.venue_name ? ` · ${t.venue_name as string}` : ''}{t.venue_address ? ` · ${t.venue_address as string}` : ''}
          </p>
        </div>
        <div className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0', statusBadge[t.status as string] ?? statusBadge.draft)}>
          {t.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0 animate-pulse" />}
          {statusLabel[t.status as string] ?? (t.status as string)}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard value={confirmedCount} label="Parejas inscritas" className="text-accent" />
        <StatCard value={activeMatches.length} label="Partidos activos" className="text-[var(--warning)]" />
        <StatCard value={finishedMatches.length} label="Finalizados" className="text-[var(--success)]" />
        <StatCard value={disputedMatches.length} label="Disputas abiertas" className="text-[var(--error)]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tournament info */}
        <div className="flex flex-col gap-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.9px] text-light">INFORMACIÓN DEL TORNEO</p>
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            {[
              { label: 'Formato', value: (t.format as string)?.replace('_', ' ') },
              { label: 'Instalación', value: t.venue_name ? `${t.venue_name}${t.venue_address ? ` — ${t.venue_address}` : ''}` : '—' },
              { label: 'Fecha', value: startDate },
              { label: 'Inscripción', value: (t.registration_type as string) === 'pair' ? 'Pareja' : 'Individual' },
              { label: 'Fase actual', value: 'Octavos de final' },
            ].map((row, i, arr) => (
              <div key={row.label} className={cn('grid gap-4 px-[18px] py-[13px] items-center', i < arr.length - 1 && 'border-b border-border')} style={{ gridTemplateColumns: '140px 1fr' }}>
                <span className="text-[12px] font-semibold text-muted-foreground">{row.label}</span>
                <span className="text-[13px] text-foreground capitalize">{row.value ?? '—'}</span>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <p className="text-[10px] font-bold uppercase tracking-[0.9px] text-light">ACCIONES RÁPIDAS</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: `/admin/${id}/inscritos`, icon: '👥', label: 'Ver inscritos' },
              { href: `/admin/${id}/cuadro`,    icon: '🏆', label: 'Ver cuadro' },
              { href: `/admin/${id}/vivo`,      icon: '▶',  label: 'Monitorizar vivo' },
              { href: `/admin/${id}/config`,    icon: '⚙',  label: 'Configuración' },
            ].map(a => (
              <Link key={a.href} href={a.href}>
                <button className="w-full text-left px-[14px] py-3 bg-card border border-border rounded-lg text-[13px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors">
                  {a.icon} {a.label}
                </button>
              </Link>
            ))}
          </div>
        </div>

        {/* Active matches */}
        <div className="flex flex-col gap-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.9px] text-light">PARTIDOS ACTIVOS AHORA</p>
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
                    <div key={m.id as string} className={cn('px-[14px] py-[11px] flex items-center gap-3 border-l-[3px] border-l-[var(--warning)]', i < arr.length - 1 && 'border-b border-border')}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--warning)] uppercase tracking-wide mb-1">{m.court_name as string ?? 'Pista'}</p>
                        <p className="text-[13px] font-semibold text-foreground truncate">
                          {m.t1p1_name as string ?? 'Equipo 1'}{m.t1p2_name_display ? ` / ${m.t1p2_name_display as string}` : ''}
                        </p>
                        <p className="text-[12px] text-muted-foreground truncate">
                          {m.t2p1_name as string ?? 'Equipo 2'}{m.t2p2_name_display ? ` / ${m.t2p2_name_display as string}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[16px] font-extrabold text-foreground leading-none">{scoreStr}</p>
                        {time && <p className="text-[11px] text-light mt-1">🕒 {time}</p>}
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

import { getTournamentById } from '@/lib/actions/tournaments'
import { getMatchesForTournament } from '@/lib/actions/matches'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function StatCard({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <p className={cn('text-4xl font-bold', className)}>{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
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
    ? new Date(t.start_date as string).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const statusLabel: Record<string, string> = {
    draft: 'Borrador', open: 'Abierto', active: 'En curso', finished: 'Finalizado'
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel</h1>
          <p className="text-sm text-muted-foreground">
            {t.name as string} · {startDate} · {t.venue_name as string}
          </p>
        </div>
        <Badge className={cn('text-sm px-3 py-1', {
          'bg-accent text-accent-foreground': t.status === 'open',
          'bg-[var(--warning)] text-[var(--warning-foreground)]': t.status === 'active',
          'bg-[var(--success-surface)] text-[var(--success)]': t.status === 'finished',
          'bg-muted text-muted-foreground': t.status === 'draft',
        })}>
          {t.status === 'active' && '● '}
          {statusLabel[t.status as string] ?? t.status as string}
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
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold uppercase text-muted-foreground">INFORMACIÓN DEL TORNEO</p>
          </div>
          <div className="divide-y divide-border">
            {[
              { label: 'Formato', value: (t.format as string)?.replace('_', ' ') },
              { label: 'Instalación', value: `${t.venue_name} — ${t.venue_address}` },
              { label: 'Fecha', value: startDate },
              { label: 'Inscripción', value: (t.registration_type as string) === 'pair' ? 'Pareja' : 'Individual' },
            ].map(row => (
              <div key={row.label} className="flex justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium text-foreground capitalize text-right max-w-xs">{row.value as string}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-border">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">ACCIONES RÁPIDAS</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/admin/${id}/inscritos`}>
                <Button variant="outline" size="sm" className="w-full">👥 Ver inscritos</Button>
              </Link>
              <Link href={`/admin/${id}/cuadro`}>
                <Button variant="outline" size="sm" className="w-full">🏆 Ver cuadro</Button>
              </Link>
              <Link href={`/admin/${id}/vivo`}>
                <Button variant="outline" size="sm" className="w-full">▶ Monitorizar en vivo</Button>
              </Link>
              <Link href={`/admin/${id}/config`}>
                <Button variant="outline" size="sm" className="w-full">⚙ Configuración</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Active matches */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold uppercase text-muted-foreground">PARTIDOS ACTIVOS AHORA</p>
          </div>
          <div className="divide-y divide-border">
            {activeMatches.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No hay partidos activos</p>
            ) : (
              activeMatches.slice(0, 5).map(m => (
                <div key={m.id as string} className="px-4 py-3 flex items-center justify-between border-l-4 border-[var(--warning)]">
                  <div>
                    <p className="text-xs font-semibold text-[var(--warning)] uppercase">{m.court_name as string}</p>
                    <p className="text-sm font-medium text-foreground">{m.t1p1_name as string ?? 'Equipo 1'} / {m.t1p2_name_display as string ?? ''}</p>
                    <p className="text-xs text-muted-foreground">{m.t2p1_name as string ?? 'Equipo 2'} / {m.t2p2_name_display as string ?? ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">—</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

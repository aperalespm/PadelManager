'use client'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface PlayerProfileProps {
  profile: Record<string, unknown>
  tournaments: Record<string, unknown>[]
  stats: Record<string, unknown>
  isOwn: boolean
}

const resultConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'En curso', className: 'bg-[var(--warning)] text-[var(--warning-foreground)]' },
  finished: { label: 'Finalizado', className: 'bg-muted text-muted-foreground' },
}

function tournamentResultLabel(t: Record<string, unknown>) {
  const status = t.tournament_status as string ?? t.status as string
  return resultConfig[status] ?? resultConfig.finished
}

export function PlayerProfile({ profile: p, tournaments, stats: s, isOwn }: PlayerProfileProps) {
  const initials = (p.display_name as string ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const winRate = s.matches_played ? Math.round(((s.matches_won as number) / (s.matches_played as number)) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Avatar + name */}
      <div className="bg-card rounded-xl border border-border p-6 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-2xl font-bold">
          {(p.avatar_url as string) ? (
            <img src={p.avatar_url as string} alt={p.display_name as string} className="w-full h-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">{p.display_name as string}</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <Badge className="bg-[var(--success-surface)] text-[var(--success)]">{p.category as string ?? '4ª'} categoría</Badge>
            <Badge className="bg-accent/10 text-accent">Activo</Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Torneos', value: s.tournaments_played as number ?? 0 },
          { label: 'Partidos', value: s.matches_played as number ?? 0 },
          { label: 'Victorias', value: s.matches_won as number ?? 0 },
        ].map(stat => (
          <div key={stat.label} className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-accent">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Win rate */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">Tasa de victoria</span>
          <span className="text-sm font-bold text-accent">{winRate}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-[var(--success)] rounded-full transition-all" style={{ width: `${winRate}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{s.matches_won as number ?? 0} victorias</span>
          <span>{((s.matches_played as number ?? 0) - (s.matches_won as number ?? 0))} derrotas</span>
        </div>
      </div>

      {/* History */}
      {tournaments.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold uppercase text-muted-foreground">HISTORIAL</p>
          </div>
          <div className="divide-y divide-border">
            {tournaments.map((t, i) => {
              const cfg = tournamentResultLabel(t)
              const date = t.start_date ? new Date(t.start_date as string).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : ''
              return (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.tournament_name as string ?? t.name as string}</p>
                    <p className="text-xs text-muted-foreground capitalize">{date}</p>
                  </div>
                  <Badge className={cn('text-xs', cfg.className)}>{cfg.label}</Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

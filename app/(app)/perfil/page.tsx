'use client'

import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils'

const mockProfile = {
  name: 'Andrés Perales',
  initials: 'AP',
  category: '3ª categoría',
  active: true,
  stats: { torneos: 5, partidos: 38, victorias: 24 },
  history: [
    { name: 'Open Leganés #1', date: 'May 2026', result: 'En curso' },
    { name: 'Copa Primavera', date: 'Mar 2026', result: 'Subcampeón' },
    { name: 'Winter Open', date: 'Ene 2026', result: 'Cuartos' },
    { name: 'Liga Otoño', date: 'Nov 2025', result: 'Ganador' },
  ],
}

function resultBadge(result: string) {
  const configs: Record<string, string> = {
    'En curso': 'bg-[var(--warning-surface)] text-[var(--warning)]',
    'Ganador': 'bg-[var(--success-surface)] text-[var(--success)]',
    'Subcampeón': 'bg-muted text-muted-foreground',
    'Cuartos': 'bg-[var(--accent-surface)] text-accent',
    'Semifinal': 'bg-[var(--accent-surface)] text-accent',
  }
  return configs[result] ?? 'bg-muted text-muted-foreground'
}

export default function PerfilPage() {
  const p = mockProfile
  const winRate = Math.round((p.stats.victorias / p.stats.partidos) * 100)
  const losses = p.stats.partidos - p.stats.victorias

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Mi perfil</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Avatar + name */}
        <div className="bg-card rounded-xl border border-border p-6 flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-2xl font-bold">
            {p.initials}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground">{p.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--success-surface)] text-[var(--success)]">
                {p.category}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                Activo
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: p.stats.torneos, label: 'Torneos' },
            { value: p.stats.partidos, label: 'Partidos' },
            { value: p.stats.victorias, label: 'Victorias' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-3xl font-bold text-accent">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Win rate */}
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Tasa de victoria</p>
            <p className="text-sm font-bold text-accent">{winRate}%</p>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--success)] rounded-full transition-all"
              style={{ width: `${winRate}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{p.stats.victorias} victorias</span>
            <span>{losses} derrotas</span>
          </div>
        </div>

        {/* History */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">HISTORIAL</p>
          </div>
          <div className="divide-y divide-border">
            {p.history.map(h => (
              <div key={h.name} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.date}</p>
                </div>
                <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', resultBadge(h.result))}>
                  {h.result === 'Ganador' && '🏆 '}{h.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

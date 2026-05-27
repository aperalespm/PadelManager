'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface AdminSidebarProps {
  tournamentId: string
  tournamentName: string
  tournamentStatus: string
  organizerName: string
}

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  open: 'Abierto',
  active: 'En curso',
  finished: 'Finalizado',
}

const statusColor: Record<string, string> = {
  draft: 'text-muted-foreground',
  open: 'text-accent',
  active: 'text-[var(--warning)]',
  finished: 'text-[var(--success)]',
}

export function AdminSidebar({ tournamentId, tournamentName, tournamentStatus, organizerName }: AdminSidebarProps) {
  const pathname = usePathname()

  const navItems = [
    { href: `/admin/${tournamentId}`, label: 'Panel', icon: '◎', exact: true },
    { href: `/admin/${tournamentId}/inscritos`, label: 'Inscritos', icon: '👥' },
    { href: `/admin/${tournamentId}/cuadro`, label: 'Cuadro', icon: '🏆' },
    { href: `/admin/${tournamentId}/vivo`, label: 'En vivo', icon: '▶' },
    { href: `/admin/${tournamentId}/config`, label: 'Configuración', icon: '⚙' },
  ]

  return (
    <aside className="w-60 min-h-screen bg-secondary text-secondary-foreground flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <Link href="/admin" className="block">
          <p className="font-bold text-base">PadelManager</p>
          <p className="text-xs text-white/50">Panel de organizador</p>
        </Link>
      </div>

      {/* Tournament info */}
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-1">TORNEO</p>
        <p className="font-semibold text-sm truncate">{tournamentName}</p>
        <p className={cn('text-xs font-medium mt-0.5', statusColor[tournamentStatus] ?? 'text-white/50')}>
          {tournamentStatus === 'active' && '● '}{statusLabel[tournamentStatus] ?? tournamentStatus}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {navItems.map(item => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent/20 text-white font-medium border-l-2 border-accent'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
              )}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-sm font-bold flex-shrink-0">
          {organizerName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{organizerName}</p>
          <p className="text-xs text-white/40">Organizador</p>
        </div>
      </div>
    </aside>
  )
}

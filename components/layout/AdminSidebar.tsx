'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface AdminSidebarProps {
  tournamentId: string
  tournamentName: string
  tournamentStatus: string
  organizerName: string
  activeMatchCount?: number
}

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  open: 'Abierto',
  active: 'En curso',
  finished: 'Finalizado',
}

const statusColor: Record<string, string> = {
  draft: 'text-white/40',
  open: 'text-accent',
  active: 'text-[var(--warning)]',
  finished: 'text-[var(--success)]',
}

export function AdminSidebar({ tournamentId, tournamentName, tournamentStatus, organizerName, activeMatchCount = 0 }: AdminSidebarProps) {
  const pathname = usePathname()

  const navItems = [
    { href: `/admin/${tournamentId}`, label: 'Panel', icon: '◉', exact: true },
    { href: `/admin/${tournamentId}/inscritos`, label: 'Inscritos', icon: '⊞' },
    { href: `/admin/${tournamentId}/cuadro`, label: 'Cuadro', icon: '🏆' },
    { href: `/admin/${tournamentId}/vivo`, label: 'En vivo', icon: '▶', badge: activeMatchCount > 0 },
    { href: `/admin/${tournamentId}/config`, label: 'Configuración', icon: '⚙' },
  ]

  const initials = organizerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <aside className="w-56 min-h-screen bg-secondary text-secondary-foreground flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <Link href="/admin" className="block">
          <p className="font-bold text-base text-white leading-tight">PadelManager</p>
          <p className="text-xs text-white/40 mt-0.5">Panel de organizador</p>
        </Link>
      </div>

      {/* Tournament info */}
      <div className="px-4 py-4 border-b border-white/10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">TORNEO</p>
        <p className="font-bold text-sm text-white leading-tight truncate">{tournamentName}</p>
        <p className={cn('text-xs font-medium mt-1 flex items-center gap-1', statusColor[tournamentStatus] ?? 'text-white/40')}>
          {tournamentStatus === 'active' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--warning)]" />}
          {statusLabel[tournamentStatus] ?? tournamentStatus}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5">
        {navItems.map(item => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-[rgba(37,99,235,0.22)] text-white font-semibold'
                  : 'text-white/55 hover:text-white hover:bg-white/8'
              )}
            >
              <span className="w-4 text-center text-base leading-none">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="w-2 h-2 rounded-full bg-[var(--warning)] shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">{organizerName}</p>
          <p className="text-xs text-white/35 leading-tight">Organizador</p>
        </div>
      </div>
    </aside>
  )
}

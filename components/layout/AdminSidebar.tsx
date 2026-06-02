'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import { createDraftTournament } from '@/lib/actions/tournaments'

interface Tournament {
  id: string
  name: string
  status: string
}

interface AdminSidebarProps {
  tournamentId: string
  tournamentName: string
  tournamentStatus: string
  organizerName: string
  activeMatchCount?: number
  tournaments: Tournament[]
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

export function AdminSidebar({ tournamentId, tournamentName, tournamentStatus, organizerName, activeMatchCount = 0, tournaments }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isCreating, startCreate] = useTransition()

  const navItems = [
    { href: `/admin/${tournamentId}`, label: 'Panel', icon: '◉', exact: true },
    { href: `/admin/${tournamentId}/inscritos`, label: 'Inscritos', icon: '⊞' },
    { href: `/admin/${tournamentId}/cuadro`, label: 'Cuadro', icon: '🏆' },
    { href: `/admin/${tournamentId}/vivo`, label: 'En vivo', icon: '▶', badge: activeMatchCount > 0 },
    { href: `/admin/${tournamentId}/config`, label: 'Configuración', icon: '⚙' },
  ]

  const initials = organizerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  function handleSwitch(newId: string) {
    const section = pathname.slice(`/admin/${tournamentId}`.length)
    router.push(`/admin/${newId}${section}`)
  }

  function handleCreate() {
    startCreate(async () => {
      const result = await createDraftTournament()
      if (!result.data) return
      router.push(`/admin/${result.data.id}/config`)
    })
  }

  return (
    <aside className="w-[220px] min-h-screen bg-secondary text-secondary-foreground flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-[18px] pt-[22px] pb-4 border-b border-white/7">
        <Link href="/admin" className="block">
          <p className="text-[16px] font-extrabold text-white tracking-[-0.4px] leading-tight">PadelManager</p>
          <p className="text-[11px] text-[#4b6a99] mt-0.5 font-medium">Panel de organizador</p>
        </Link>
      </div>

      {/* Tournament switcher */}
      <div className="px-[18px] py-[14px] border-b border-white/7">
        <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-[#4b6a99] mb-1.5">TORNEO</p>

        <div className="relative mt-1">
          <select
            value={tournamentId}
            onChange={e => handleSwitch(e.target.value)}
            className="w-full appearance-none cursor-pointer outline-none pr-7 py-[7px] px-[10px] rounded-[6px] bg-white/10 border border-white/15 text-white text-[13px] font-bold truncate hover:bg-white/15 transition-colors"
            style={{ color: 'white' }}
          >
            {tournaments.map(t => (
              <option key={t.id} value={t.id} style={{ backgroundColor: '#1e293b', color: 'white' }}>
                {t.name}
              </option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/70 text-[16px] pointer-events-none">▾</span>
        </div>

        <p className={cn('text-[11px] font-semibold mt-1.5 flex items-center gap-1.5 pl-[2px]', statusColor[tournamentStatus] ?? 'text-white/40')}>
          {tournamentStatus === 'active' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse shrink-0" />}
          {statusLabel[tournamentStatus] ?? tournamentStatus}
        </p>

        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-2.5 py-[7px] rounded-[6px] bg-accent text-white text-[11px] font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
        >
          <span className="text-[14px] leading-none">+</span>
          {isCreating ? 'Creando...' : 'Crear torneo'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-[10px]">
        {navItems.map(item => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-[13px] transition-colors',
                isActive
                  ? 'bg-[rgba(37,99,235,0.22)] text-white font-semibold'
                  : 'text-[#94a3b8] hover:text-white hover:bg-white/8 font-medium'
              )}
            >
              <span className="w-[18px] text-center text-[14px] leading-none shrink-0" style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="w-[7px] h-[7px] rounded-full bg-[var(--warning)] shrink-0 animate-pulse" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-[14px] border-t border-white/7 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-[13px] font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white truncate leading-tight">{organizerName}</p>
          <p className="text-[11px] text-[#4b6a99] leading-tight mt-0.5">Organizador</p>
        </div>
      </div>
    </aside>
  )
}

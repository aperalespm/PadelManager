'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  {
    href: '/torneos',
    label: 'Torneos',
    icon: '🎾',
    isActive: (pathname: string) =>
      pathname.startsWith('/torneos') ||
      pathname.startsWith('/t/') ||
      pathname.startsWith('/inscripcion'),
  },
  {
    href: '/mi-torneo',
    label: 'Mi torneo',
    icon: '🏆',
    isActive: (pathname: string) => pathname.startsWith('/mi-torneo'),
  },
  {
    href: '/perfil',
    label: 'Perfil',
    icon: '👤',
    isActive: (pathname: string) => pathname.startsWith('/perfil'),
  },
]

export function BottomNav() {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  const isAuth = pathname.startsWith('/login') || pathname.startsWith('/register')

  if (isAdmin || isAuth) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-4">
        {tabs.map(tab => {
          const isActive = tab.isActive(pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center gap-0.5 text-xs font-medium transition-colors relative pb-1',
                isActive ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

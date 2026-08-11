'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

interface AdminUserMenuProps {
  email: string
  name?: string | null
}

export function AdminUserMenu({ email, name }: AdminUserMenuProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    setLoading(true)
    await authClient.signOut()
    router.push('/login')
  }

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : email[0].toUpperCase()

  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-semibold">
        {initials}
      </div>
      <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-[140px]">
        {name ?? email}
      </span>
      <button
        onClick={handleLogout}
        disabled={loading}
        className="ml-1 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        {loading ? '...' : 'Salir'}
      </button>
    </div>
  )
}

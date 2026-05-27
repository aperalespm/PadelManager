'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { useCallback } from 'react'

const categories = ['Todas', '1ª', '2ª', '3ª', '4ª']
const statuses = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Abiertos' },
  { value: 'active', label: 'En curso' },
  { value: 'finished', label: 'Finalizados' },
]

export function TournamentFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const currentStatus = searchParams.get('status') ?? ''
  const currentCategory = searchParams.get('category') ?? ''

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar torneo..."
          className="pl-9"
          defaultValue={searchParams.get('search') ?? ''}
          onChange={e => updateParam('search', e.target.value)}
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {statuses.map(s => (
          <Button
            key={s.value}
            variant={currentStatus === s.value ? 'default' : 'outline'}
            size="sm"
            className={currentStatus === s.value ? 'bg-accent text-accent-foreground flex-shrink-0' : 'flex-shrink-0'}
            onClick={() => updateParam('status', s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map(c => (
          <Button
            key={c}
            variant={currentCategory === (c === 'Todas' ? '' : c) ? 'default' : 'outline'}
            size="sm"
            className={currentCategory === (c === 'Todas' ? '' : c) ? 'bg-accent text-accent-foreground flex-shrink-0' : 'flex-shrink-0'}
            onClick={() => updateParam('category', c === 'Todas' ? '' : c)}
          >
            {c}
          </Button>
        ))}
      </div>
    </div>
  )
}

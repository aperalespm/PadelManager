'use client'

import { useState, useTransition } from 'react'
import { confirmRegistration, promoteFromWaitlist } from '@/lib/actions/registrations'
import { closeTournamentRegistrations } from '@/lib/actions/tournaments'
import { generateBracket } from '@/lib/actions/bracket'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Download, Search } from 'lucide-react'

interface RegistrationTableProps {
  tournamentId: string
  tournament: Record<string, unknown>
  registrations: Record<string, unknown>[]
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-[var(--warning-surface)] text-[var(--warning)] border border-[var(--warning)]' },
  confirmed: { label: 'Confirmado', className: 'bg-[var(--success-surface)] text-[var(--success)]' },
  waitlist: { label: 'Lista espera', className: 'bg-[var(--waitlist-surface)] text-[var(--waitlist)]' },
}

export function RegistrationTable({ tournamentId, tournament: t, registrations: initialRegs }: RegistrationTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState('Todos')
  const [search, setSearch] = useState('')

  const confirmed = initialRegs.filter(r => r.status === 'confirmed').length
  const pending = initialRegs.filter(r => r.status === 'pending').length
  const waitlist = initialRegs.filter(r => r.status === 'waitlist').length
  const maxPlayers = t.max_players as number

  const filterTabs = [
    { key: 'Todos', label: `Todos (${initialRegs.length})` },
    { key: 'Pendientes', label: `Pendientes (${pending})` },
    { key: 'Confirmados', label: `Confirmados (${confirmed})` },
    { key: 'Lista espera', label: `Lista espera (${waitlist})` },
  ]

  const filtered = initialRegs.filter(r => {
    const matchesFilter =
      filter === 'Todos' ||
      (filter === 'Pendientes' && r.status === 'pending') ||
      (filter === 'Confirmados' && r.status === 'confirmed') ||
      (filter === 'Lista espera' && r.status === 'waitlist')

    const name = `${r.player1_name ?? ''} ${r.player2_display_name ?? ''}`.toLowerCase()
    const matchesSearch = !search || name.includes(search.toLowerCase())

    return matchesFilter && matchesSearch
  })

  function handleConfirm(id: string) {
    startTransition(async () => {
      await confirmRegistration(id)
      router.refresh()
    })
  }

  function handlePromote(id: string) {
    startTransition(async () => {
      await promoteFromWaitlist(id)
      router.refresh()
    })
  }

  async function handleCloseAndGenerate() {
    await closeTournamentRegistrations(tournamentId)
    await generateBracket(tournamentId)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inscritos</h1>
          <p className="text-sm text-muted-foreground">Gestión de inscripciones — {t.name as string}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          {t.status === 'open' && (
            <Button
              onClick={handleCloseAndGenerate}
              disabled={isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Cerrar inscripciones
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-3xl font-bold text-accent">{confirmed}</p>
          <p className="text-sm text-muted-foreground">Confirmados</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-3xl font-bold text-[var(--warning)]">{pending}</p>
          <p className="text-sm text-muted-foreground">Pendientes</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-3xl font-bold text-[var(--waitlist)]">{waitlist}</p>
          <p className="text-sm text-muted-foreground">Lista de espera</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-3xl font-bold text-accent">{confirmed}/{maxPlayers}</p>
          <p className="text-sm text-muted-foreground">Ocupación</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              filter === tab.key
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-card text-muted-foreground border-border hover:border-accent/40'
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar jugador..."
            className="pl-8 w-48"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jugador / Pareja</TableHead>
              <TableHead>Cat.</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => {
              const status = r.status as string
              const cfg = statusConfig[status] ?? statusConfig.pending
              const name = r.player2_display_name
                ? `${r.player1_name}, ${r.player2_display_name}`
                : r.player2_name
                ? `${r.player1_name} (+ ${r.player2_name})`
                : `${r.player1_name as string} (sin pareja)`
              const date = r.created_at
                ? new Date(r.created_at as string).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                : '—'

              return (
                <TableRow key={r.id as string}>
                  <TableCell className="font-medium text-foreground">{name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.player1_category as string ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">
                    {r.player2_id || r.player2_name ? 'Pareja' : 'Individual'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{date}</TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs', cfg.className)}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(r.id as string)}
                        disabled={isPending}
                        className="bg-accent text-accent-foreground hover:bg-accent/90"
                      >
                        ✓ Confirmar
                      </Button>
                    )}
                    {status === 'waitlist' && (
                      <Button
                        size="sm"
                        onClick={() => handlePromote(r.id as string)}
                        disabled={isPending}
                        className="bg-[var(--warning)] text-[var(--warning-foreground)] hover:bg-[var(--warning)]/90"
                      >
                        ↑ Ascender
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

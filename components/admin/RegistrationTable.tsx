'use client'

import { useState, useTransition } from 'react'
import {
  confirmRegistration,
  promoteFromWaitlist,
  deleteRegistration,
  removePlayerFromPair,
  updateRegistration,
} from '@/lib/actions/registrations'
import { closeTournamentRegistrations } from '@/lib/actions/tournaments'
import { generateBracket } from '@/lib/actions/bracket'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Download, Search, Pencil, Trash2, X, Users, User } from 'lucide-react'
import { AddParticipantModal } from '@/components/admin/AddParticipantModal'

interface RegistrationTableProps {
  tournamentId: string
  tournament: Record<string, unknown>
  registrations: Record<string, unknown>[]
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-[var(--amber-surface)] text-[var(--amber)] border-0' },
  confirmed: { label: 'Confirmado', className: 'bg-[var(--success-surface)] text-[var(--success)] border-0' },
  waitlist: { label: 'Lista espera', className: 'bg-[var(--waitlist-surface)] text-[var(--waitlist)] border-0' },
}

const SYSTEM_FORM_KEYS = ['name', 'partner_name', 'email', 'partner_email', 'category']

interface PlayerRow {
  registrationId: string
  playerIndex: 1 | 2
  name: string
  partnerName: string | null
  category: string | null
  status: string
  date: string
  registration: Record<string, unknown>
}

function buildPlayerRows(regs: Record<string, unknown>[]): PlayerRow[] {
  const rows: PlayerRow[] = []
  for (const r of regs) {
    const fd = (r.form_data as Record<string, unknown>) ?? {}
    const cat = (fd.category as string) || (r.player1_category as string) || null
    const date = r.created_at
      ? new Date(r.created_at as string).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      : '—'
    const p1 = (r.player1_name as string) || '?'
    const p2 = (r.player2_name as string) || null
    rows.push({
      registrationId: r.id as string,
      playerIndex: 1,
      name: p1,
      partnerName: p2,
      category: cat,
      status: r.status as string,
      date,
      registration: r,
    })
    if (p2) {
      rows.push({
        registrationId: r.id as string,
        playerIndex: 2,
        name: p2,
        partnerName: p1,
        category: cat,
        status: r.status as string,
        date,
        registration: r,
      })
    }
  }
  return rows
}

export function RegistrationTable({ tournamentId, tournament: t, registrations: initialRegs }: RegistrationTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState('Todos')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  const [viewMode, setViewMode] = useState<'players' | 'pairs'>('players')
  const [editReg, setEditReg] = useState<Record<string, unknown> | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'pair' | 'player'
    registrationId: string
    playerIndex?: 1 | 2
    playerName: string
    partnerName?: string | null
  } | null>(null)

  // Edit panel field states
  const [editP1, setEditP1] = useState('')
  const [editP2, setEditP2] = useState('')
  const [editStatus, setEditStatus] = useState<'confirmed' | 'pending' | 'waitlist'>('confirmed')
  const [editFormData, setEditFormData] = useState<Record<string, unknown>>({})
  const [isSavingEdit, startSaveEdit] = useTransition()

  const registrationTypes: string[] = (() => {
    try {
      const config = t.registration_config as { registration_types?: string[] } | null | undefined
      if (config?.registration_types && Array.isArray(config.registration_types)) {
        return config.registration_types
      }
    } catch {
      // fallback below
    }
    return [(t.registration_type as string) ?? 'pair']
  })()

  const categoryOptions: string[] = (() => {
    const vd = (t.venue_details as Record<string, unknown>) ?? {}
    const rawCats = (vd.categories as Array<{ name: string; genders?: string[] }>) ?? []
    const result: string[] = []
    for (const cat of rawCats) {
      if (!cat.name?.trim()) continue
      if (!cat.genders || cat.genders.length === 0) {
        result.push(cat.name)
      } else {
        for (const g of cat.genders) {
          const suffix = g === 'masculino' ? ' Masculino' : g === 'femenino' ? ' Femenino' : ' Mixto'
          result.push(cat.name + suffix)
        }
      }
    }
    return result
  })()

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

    const name = `${r.player1_name ?? ''} ${r.player2_name ?? ''}`.toLowerCase()
    const matchesSearch = !search || name.includes(search.toLowerCase())

    return matchesFilter && matchesSearch
  })

  const playerRows = buildPlayerRows(filtered)

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

  function openEdit(reg: Record<string, unknown>) {
    const fd = (reg.form_data as Record<string, unknown>) ?? {}
    setEditReg(reg)
    setEditP1((reg.player1_name as string) || '')
    setEditP2((reg.player2_name as string) || '')
    setEditStatus((reg.status as 'confirmed' | 'pending' | 'waitlist') || 'confirmed')
    setEditFormData({ ...fd })
  }

  function handleSaveEdit() {
    if (!editReg) return
    startSaveEdit(async () => {
      const result = await updateRegistration({
        registrationId: editReg.id as string,
        player1_name: editP1,
        player2_name: editP2 || null,
        status: editStatus,
        form_data: editFormData,
      })
      if (!result.error) {
        setEditReg(null)
        router.refresh()
      }
    })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    startTransition(async () => {
      if (deleteTarget.type === 'pair') {
        await deleteRegistration(deleteTarget.registrationId)
      } else if (deleteTarget.playerIndex !== undefined) {
        await removePlayerFromPair(deleteTarget.registrationId, deleteTarget.playerIndex)
      }
      setDeleteTarget(null)
      router.refresh()
    })
  }

  function handleDeletePairFull() {
    if (!deleteTarget) return
    startTransition(async () => {
      await deleteRegistration(deleteTarget.registrationId)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  // Other form_data keys (not system keys)
  const otherFormDataKeys = editReg
    ? Object.keys((editReg.form_data as Record<string, unknown>) ?? {}).filter(
        k => !SYSTEM_FORM_KEYS.includes(k)
      )
    : []

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground tracking-[-0.5px]">Inscritos</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Gestión de inscripciones — {t.name as string}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            + Añadir participante
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-[10px] py-[18px] px-5">
          <p className="text-[28px] font-extrabold leading-none tracking-[-1px] text-accent">{confirmed}</p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Confirmados</p>
        </div>
        <div className="bg-card border border-border rounded-[10px] py-[18px] px-5">
          <p className="text-[28px] font-extrabold leading-none tracking-[-1px] text-[var(--amber)]">{pending}</p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Pendientes</p>
        </div>
        <div className="bg-card border border-border rounded-[10px] py-[18px] px-5">
          <p className="text-[28px] font-extrabold leading-none tracking-[-1px] text-[var(--waitlist)]">{waitlist}</p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Lista de espera</p>
        </div>
        <div className="bg-card border border-border rounded-[10px] py-[18px] px-5">
          <p className="text-[28px] font-extrabold leading-none tracking-[-1px] text-accent">{confirmed}/{maxPlayers}</p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Ocupación</p>
        </div>
      </div>

      {/* View toggle + filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Segmented control for view mode */}
        <div className="flex bg-[var(--muted)] rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode('players')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              viewMode === 'players'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <User className="w-3.5 h-3.5" />
            Jugadores
          </button>
          <button
            onClick={() => setViewMode('pairs')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              viewMode === 'pairs'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Parejas
          </button>
        </div>

        {/* Filter tabs */}
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === tab.key
                ? 'bg-[var(--accent-surface)] text-accent border-accent font-semibold'
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
        {viewMode === 'players' ? (
          <Table>
            <TableHeader className="bg-[var(--muted)]">
              <TableRow className="border-b border-border">
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Jugador</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Pareja</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Cat.</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Estado</TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wide text-light">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {playerRows.map(row => {
                const cfg = statusConfig[row.status] ?? statusConfig.pending
                return (
                  <TableRow key={`${row.registrationId}-${row.playerIndex}`}>
                    <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.partnerName ?? '—'}
                    </TableCell>
                    <TableCell>
                      {row.category ? (
                        <span className="bg-[var(--accent-surface)] text-accent text-[11px] font-semibold px-[7px] py-0.5 rounded">
                          {row.category}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', cfg.className)}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {row.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => handleConfirm(row.registrationId)}
                            disabled={isPending}
                            className="bg-accent text-accent-foreground hover:bg-accent/90"
                          >
                            ✓ Confirmar
                          </Button>
                        )}
                        {row.status === 'waitlist' && (
                          <Button
                            size="sm"
                            onClick={() => handlePromote(row.registrationId)}
                            disabled={isPending}
                            className="bg-[var(--warning)] text-[var(--warning-foreground)] hover:bg-[var(--warning)]/90"
                          >
                            ↑ Ascender
                          </Button>
                        )}
                        <button
                          onClick={() => openEdit(row.registration)}
                          className="p-1.5 rounded hover:bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (row.partnerName) {
                              setDeleteTarget({
                                type: 'player',
                                registrationId: row.registrationId,
                                playerIndex: row.playerIndex,
                                playerName: row.name,
                                partnerName: row.partnerName,
                              })
                            } else {
                              setDeleteTarget({
                                type: 'pair',
                                registrationId: row.registrationId,
                                playerName: row.name,
                              })
                            }
                          }}
                          className="p-1.5 rounded hover:bg-[var(--error-surface,#fef2f2)] text-muted-foreground hover:text-[var(--error)] transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader className="bg-[var(--muted)]">
              <TableRow className="border-b border-border">
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Jugador / Pareja</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Cat.</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Tipo</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Fecha</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Estado</TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wide text-light">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const status = r.status as string
                const cfg = statusConfig[status] ?? statusConfig.pending
                const fd = (r.form_data as Record<string, unknown>) ?? {}
                const cat = (fd.category as string) || (r.player1_category as string) || null
                const p1 = (r.player1_name as string) || '?'
                const p2 = (r.player2_name as string) || null
                const name = p2 ? `${p1} (+ ${p2})` : p1
                const date = r.created_at
                  ? new Date(r.created_at as string).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : '—'

                return (
                  <TableRow key={r.id as string}>
                    <TableCell className="font-medium text-foreground">{name}</TableCell>
                    <TableCell>
                      {cat ? (
                        <span className="bg-[var(--accent-surface)] text-accent text-[11px] font-semibold px-[7px] py-0.5 rounded">
                          {cat}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {p2 ? 'Pareja' : 'Individual'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{date}</TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', cfg.className)}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded hover:bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              type: 'pair',
                              registrationId: r.id as string,
                              playerName: name,
                            })
                          }
                          className="p-1.5 rounded hover:bg-[var(--error-surface,#fef2f2)] text-muted-foreground hover:text-[var(--error)] transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── Edit Slide-Over Panel ── */}
      {editReg && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setEditReg(null)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full z-50 bg-card border-l border-border flex flex-col"
            style={{ width: '400px' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-[16px] font-bold text-foreground">Editar inscripción</h2>
              <button
                onClick={() => setEditReg(null)}
                className="p-1.5 rounded hover:bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {/* Jugador */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Jugador
                </label>
                <Input
                  value={editP1}
                  onChange={e => setEditP1(e.target.value)}
                  placeholder="Nombre del jugador"
                />
              </div>

              {/* Pareja */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Pareja <span className="font-normal normal-case">(opcional)</span>
                </label>
                <Input
                  value={editP2}
                  onChange={e => setEditP2(e.target.value)}
                  placeholder="Nombre de la pareja"
                />
              </div>

              {/* Estado segmented control */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Estado
                </label>
                <div className="flex bg-[var(--muted)] rounded-lg p-0.5 gap-0.5">
                  {(
                    [
                      { value: 'confirmed', label: 'Confirmado' },
                      { value: 'pending', label: 'Pendiente' },
                      { value: 'waitlist', label: 'Lista espera' },
                    ] as { value: 'confirmed' | 'pending' | 'waitlist'; label: string }[]
                  ).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setEditStatus(opt.value)}
                      className={cn(
                        'flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors',
                        editStatus === opt.value
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categoría */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Categoría
                </label>
                {categoryOptions.length > 0 ? (
                  <select
                    value={(editFormData.category as string) ?? ''}
                    onChange={e => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="border border-border rounded-[8px] text-[14px] bg-background px-3 py-2 w-full outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
                  >
                    <option value="">Sin categoría</option>
                    {categoryOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={(editFormData.category as string) ?? ''}
                    onChange={e => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Ej. A, B, mixto..."
                  />
                )}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Email <span className="font-normal normal-case">(opcional)</span>
                </label>
                <Input
                  type="email"
                  value={(editFormData.email as string) ?? ''}
                  onChange={e => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@ejemplo.com"
                />
              </div>

              {/* Email pareja */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Email pareja <span className="font-normal normal-case">(opcional)</span>
                </label>
                <Input
                  type="email"
                  value={(editFormData.partner_email as string) ?? ''}
                  onChange={e => setEditFormData(prev => ({ ...prev, partner_email: e.target.value }))}
                  placeholder="email@ejemplo.com"
                />
              </div>

              {/* Otros campos */}
              {otherFormDataKeys.map(key => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {key}
                  </label>
                  <Input
                    value={(editFormData[key] as string) ?? ''}
                    onChange={e => setEditFormData(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {/* Panel footer */}
            <div className="px-5 py-4 border-t border-border flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditReg(null)}
                disabled={isSavingEdit}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Dialog ── */}
      {deleteTarget && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setDeleteTarget(null)}
          />
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-lg max-w-sm w-full p-6 flex flex-col gap-4">
              {deleteTarget.type === 'player' && deleteTarget.partnerName ? (
                <>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground">Eliminar jugador</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      ¿Qué deseas hacer con la inscripción de{' '}
                      <span className="font-semibold text-foreground">{deleteTarget.playerName}</span>?
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleDeleteConfirm}
                      disabled={isPending}
                      className="w-full bg-[var(--amber)] text-white hover:bg-[var(--amber)]/90"
                    >
                      Solo eliminar {deleteTarget.playerName}
                    </Button>
                    <Button
                      onClick={handleDeletePairFull}
                      disabled={isPending}
                      variant="destructive"
                      className="w-full"
                    >
                      Eliminar también a {deleteTarget.partnerName}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setDeleteTarget(null)}
                      disabled={isPending}
                    >
                      Cancelar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-[16px] font-bold text-foreground">
                      {deleteTarget.type === 'pair' ? 'Eliminar pareja' : 'Eliminar jugador'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      ¿Seguro que quieres eliminar a{' '}
                      <span className="font-semibold text-foreground">{deleteTarget.playerName}</span>? Esta acción no se puede deshacer.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setDeleteTarget(null)}
                      disabled={isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={handleDeleteConfirm}
                      disabled={isPending}
                    >
                      Eliminar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showAddModal && (
        <AddParticipantModal
          tournamentId={tournamentId}
          registrationTypes={registrationTypes}
          categories={categoryOptions}
          onSuccess={() => {
            setShowAddModal(false)
            router.refresh()
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}

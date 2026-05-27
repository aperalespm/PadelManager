import { getMyTournaments } from '@/lib/actions/tournaments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-muted text-muted-foreground' },
  open: { label: 'Abierto', className: 'bg-accent text-accent-foreground' },
  active: { label: 'En curso', className: 'bg-[var(--warning)] text-[var(--warning-foreground)]' },
  finished: { label: 'Finalizado', className: 'bg-[var(--success-surface)] text-[var(--success)]' },
}

export default async function AdminPage() {
  const result = await getMyTournaments()
  const tournaments = 'data' in result ? result.data ?? [] : []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold text-foreground tracking-[-0.5px]">PadelManager</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Panel de organizador</p>
          </div>
          <Link href="/admin/nuevo">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
              <Plus className="w-4 h-4" />
              Crear torneo
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.9px] text-light mb-4">MIS TORNEOS</h2>
        {tournaments.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No tienes torneos</EmptyTitle>
              <EmptyDescription>Crea tu primer torneo para empezar a gestionar inscripciones y partidos.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/admin/nuevo">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                  <Plus className="w-4 h-4" />
                  Crear torneo
                </Button>
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-[var(--muted)]">
                <TableRow className="border-b border-border">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Nombre</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Fecha</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Categoría</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Estado</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-light">Inscritos</TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase tracking-wide text-light">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tournaments as Record<string, unknown>[]).map(t => {
                  const status = (t.status as string) ?? 'draft'
                  const cfg = statusConfig[status] ?? statusConfig.draft
                  const startDate = t.start_date
                    ? new Date(t.start_date as string).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'
                  return (
                    <TableRow key={t.id as string}>
                      <TableCell className="font-medium text-foreground">{t.name as string}</TableCell>
                      <TableCell className="text-muted-foreground">{startDate}</TableCell>
                      <TableCell className="text-muted-foreground">{t.category as string}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', cfg.className)}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(t.confirmed_count as number) ?? 0}/{t.max_players as number}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/${t.id}`}>
                          <Button variant="ghost" size="sm" className="text-accent">
                            Ver panel →
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  )
}

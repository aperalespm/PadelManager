import { getTournamentBySlug } from '@/lib/actions/tournaments'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Calendar, MapPin, Users, Share2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: 'Abierto', className: 'bg-accent text-accent-foreground' },
  active: { label: 'En curso', className: 'bg-[var(--warning)] text-[var(--warning-foreground)]' },
  finished: { label: 'Finalizado', className: 'bg-muted text-muted-foreground' },
  draft: { label: 'Próximamente', className: 'bg-muted text-muted-foreground' },
}

export default async function TorneoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tournament = await getTournamentBySlug(slug)

  if (!tournament) notFound()

  const t = tournament
  const status = (t.status as string) ?? 'open'
  const cfg = statusConfig[status] ?? statusConfig.open
  const confirmed = (t.confirmed_count as number) ?? 0
  const maxPlayers = (t.max_players as number) ?? 0
  const startDate = t.start_date ? new Date(t.start_date as string).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const isOpen = status === 'open'

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative h-48 bg-muted overflow-hidden">
        {t.cover_url ? (
          <img src={t.cover_url as string} alt={t.name as string} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent/20 to-muted" />
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div>
            <Badge className={cn('text-xs mb-2', cfg.className)}>{cfg.label}</Badge>
            <h1 className="text-xl font-bold text-white leading-tight">{t.name as string}</h1>
          </div>
          {t.logo_url && (
            <img src={t.logo_url as string} alt="logo" className="w-12 h-12 rounded-lg object-cover" />
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Info */}
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="capitalize">{startDate}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-2 text-sm text-foreground">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <div>
              <p>{t.venue_name as string}</p>
              {t.venue_address && <p className="text-muted-foreground text-xs">{t.venue_address as string}</p>}
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span>{confirmed}/{maxPlayers} plazas • {(t.registration_type as string) === 'pair' ? 'Inscripción por pareja' : 'Individual'}</span>
          </div>
        </div>

        {/* Details */}
        <div className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Categoría</span>
            <span className="font-medium text-foreground">{t.category as string}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Formato</span>
            <span className="font-medium text-foreground capitalize">{(t.format as string)?.replace('_', ' ')}</span>
          </div>
          {t.price_info && (
            <>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Precio</span>
                <span className="font-medium text-foreground">{t.price_info as string}</span>
              </div>
            </>
          )}
        </div>

        {t.description && (
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm text-foreground">{t.description as string}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {isOpen ? (
            <Link href={`/inscripcion/${t.id}`} className="w-full">
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                Inscribirse
              </Button>
            </Link>
          ) : (
            <Button disabled className="w-full">
              {status === 'active' ? 'Torneo en curso' : 'Inscripciones cerradas'}
            </Button>
          )}
          <Button variant="outline" className="w-full gap-2">
            <Share2 className="w-4 h-4" />
            Compartir
          </Button>
        </div>
      </div>
    </div>
  )
}

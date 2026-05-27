import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TournamentCardProps {
  tournament: Record<string, unknown>
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: 'Abierto', className: 'bg-accent text-accent-foreground' },
  active: { label: 'En curso', className: 'bg-[var(--warning)] text-[var(--warning-foreground)]' },
  finished: { label: 'Finalizado', className: 'bg-muted text-muted-foreground' },
  draft: { label: 'Borrador', className: 'bg-muted text-muted-foreground' },
}

export function TournamentCard({ tournament: t }: TournamentCardProps) {
  const status = (t.status as string) ?? 'open'
  const cfg = statusConfig[status] ?? statusConfig.open
  const confirmed = (t.confirmed_count as number) ?? 0
  const maxPlayers = (t.max_players as number) ?? 0
  const slug = (t.share_slug as string) ?? t.id

  const startDate = t.start_date ? new Date(t.start_date as string).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  return (
    <Link href={`/t/${slug}`}>
      <div className="bg-card rounded-xl border border-border overflow-hidden hover:border-accent/40 transition-colors">
        {t.cover_url != null && (
          <div className="h-32 bg-muted overflow-hidden">
            <img src={t.cover_url as string} alt={t.name as string} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground text-base leading-tight">{t.name as string}</h3>
            <Badge className={cn('text-xs flex-shrink-0', cfg.className)}>{cfg.label}</Badge>
          </div>

          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{startDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{t.venue_name as string}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{confirmed}/{maxPlayers} plazas</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{t.category as string}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{(t.format as string)?.replace('_', ' ')}</Badge>
            {t.price_info != null && <span className="text-xs text-muted-foreground">{t.price_info as string}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}

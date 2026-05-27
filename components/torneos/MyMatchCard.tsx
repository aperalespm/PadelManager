'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface MyMatchCardProps {
  match: Record<string, unknown>
  userId: string
}

function TeamRow({ isUser, initials, name, partner }: { isUser: boolean; initials: string; name: string; partner?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
        isUser ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
      )}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{name}</p>
        {partner && <p className="text-xs text-muted-foreground truncate">{partner}</p>}
      </div>
      {isUser && <span className="text-xs font-medium text-accent">Tú</span>}
    </div>
  )
}

export function MyMatchCard({ match: m, userId }: MyMatchCardProps) {
  const router = useRouter()
  const status = m.status as string
  const isTeam1 = m.t1p1 === userId || m.t1p2 === userId

  const myTeamName = isTeam1
    ? `${m.t1p1_name as string ?? 'Tú'}${m.t1p2_name ? ` / ${m.t1p2_name}` : ''}`
    : `${m.t2p1_name as string ?? 'Tú'}${m.t2p2_name ? ` / ${m.t2p2_name}` : ''}`

  const rivalName = isTeam1
    ? `${m.t2p1_name as string ?? 'Rival'}${m.t2p2_name ? ` / ${m.t2p2_name}` : ''}`
    : `${m.t1p1_name as string ?? 'Rival'}${m.t1p2_name ? ` / ${m.t1p2_name}` : ''}`

  const myInitials = myTeamName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const rivalInitials = rivalName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  const hour = m.scheduled_at
    ? new Date(m.scheduled_at as string).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  const isFinished = status === 'finished'
  const isValidating = status === 'validating' || status === 'disputed'
  const score = m.score_team2 as Array<{ vosotros: number; rival: number }> | null

  const badgeEl = isFinished
    ? <Badge className="bg-[var(--success)] text-[var(--success-foreground)] text-xs">✓ Confirmado</Badge>
    : isValidating
    ? <Badge className="bg-[var(--warning-surface)] text-[var(--warning)] border border-[var(--warning)] text-xs">⚠️ Pendiente validar</Badge>
    : <Badge className="bg-[var(--warning)] text-[var(--warning-foreground)] text-xs">● En juego</Badge>

  return (
    <div className="flex flex-col gap-3">
      {/* Match header card */}
      <div className="bg-accent text-accent-foreground rounded-xl p-4">
        <div className="flex justify-between items-start text-xs font-semibold uppercase tracking-wide opacity-80 mb-2">
          <span>{m.phase_name as string ?? 'Fase'}</span>
          <span>Hora</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold">{m.court_name as string ?? 'Por confirmar'}</span>
          <span className="text-2xl font-bold">{hour}</span>
        </div>
        <div className="mt-2">{badgeEl}</div>
      </div>

      {/* Teams */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-col divide-y divide-border">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">TU PAREJA</p>
          <TeamRow isUser={true} initials={myInitials} name={myTeamName} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mt-2 mb-1">RIVAL</p>
          <TeamRow isUser={false} initials={rivalInitials} name={rivalName} />
        </div>
      </div>

      {/* Validating state: show rival score */}
      {isValidating && score && (
        <div className="bg-[var(--warning-surface)] rounded-xl border border-[var(--warning)] p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase text-[var(--warning)]">⚠️ RESULTADO DEL RIVAL</p>
          <div className="flex gap-3">
            {score.map((s, i) => (
              <div key={i} className="flex-1 bg-card rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{i + 1}º set</p>
                <div className="flex justify-around items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Vos.</p>
                    <p className="text-2xl font-bold text-foreground">{s.rival}</p>
                  </div>
                  <span className="text-muted-foreground">—</span>
                  <div>
                    <p className="text-xs text-muted-foreground">Rival</p>
                    <p className="text-2xl font-bold text-foreground">{s.vosotros}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {status === 'disputed' && (
            <p className="text-xs text-[var(--warning)]">⚠️ Han introducido un resultado diferente. Revisalo.</p>
          )}
        </div>
      )}

      {/* Finished: next match message */}
      {isFinished && (
        <div className="bg-[var(--success-surface)] rounded-xl border border-[var(--success)] p-4">
          <p className="text-sm text-[var(--success)]">
            🎉 ¡Bien! Vuestro siguiente partido es a las {hour} en {m.court_name as string ?? 'Pista por confirmar'}.
          </p>
        </div>
      )}

      {/* Actions */}
      {!isFinished && !isValidating && (
        <Button
          onClick={() => router.push('/mi-torneo/resultado')}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          Introducir resultado
        </Button>
      )}
      {isValidating && (
        <Button
          onClick={() => router.push('/mi-torneo/validar')}
          className="w-full bg-[var(--warning)] text-[var(--warning-foreground)] hover:bg-[var(--warning)]/90"
        >
          Validar resultado del rival
        </Button>
      )}
    </div>
  )
}

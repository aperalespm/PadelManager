'use client'

import { useState, useTransition } from 'react'
import { submitMatchResult } from '@/lib/actions/matches'
import { cn } from '@/lib/utils'

interface Props {
  match: {
    id: string
    t1Name: string
    t2Name: string
    courtName: string
    scheduledAt: string | null
    status: string
    finalScore: Array<{ vosotros: number; rival: number }> | null
  }
  onClose: () => void
  onSuccess: (allGroupsDone: boolean) => void
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function MatchScoreSheet({ match, onClose, onSuccess }: Props) {
  const initial: Array<{ t1: number; t2: number }> = match.finalScore?.map(s => ({ t1: s.vosotros, t2: s.rival })) ?? [{ t1: 0, t2: 0 }]
  const [scores, setScores] = useState<Array<{ t1: number; t2: number }>>(initial)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  let t1Sets = 0, t2Sets = 0
  for (const s of scores) {
    if (s.t1 > s.t2) t1Sets++
    else if (s.t2 > s.t1) t2Sets++
  }
  const winner = t1Sets > t2Sets ? match.t1Name : t2Sets > t1Sets ? match.t2Name : null

  const update = (idx: number, team: 't1' | 't2', delta: number) =>
    setScores(prev => prev.map((s, i) => i === idx ? { ...s, [team]: Math.max(0, s[team] + delta) } : s))

  function handleSubmit() {
    if (!winner) { setError('El resultado no tiene ganador claro (sets empatados)'); return }
    setError(null)
    startTransition(async () => {
      const res = await submitMatchResult(match.id, scores)
      if ('error' in res) { setError(res.error) } else { onSuccess(res.data.allGroupsDone) }
    })
  }

  const btn = 'w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-[20px] font-bold text-foreground active:bg-muted/60 select-none'

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl max-h-[92dvh] overflow-y-auto flex flex-col">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Match header */}
        <div className="px-5 pb-4 border-b border-border shrink-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {match.courtName}{match.scheduledAt ? ` · ${formatTime(match.scheduledAt)}` : ''}
          </p>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <p className="text-[15px] font-bold text-foreground leading-tight">{match.t1Name}</p>
            <p className="text-[12px] font-medium text-muted-foreground">vs</p>
            <p className="text-[15px] font-bold text-foreground leading-tight text-right">{match.t2Name}</p>
          </div>
        </div>

        {/* Score inputs */}
        <div className="px-5 py-4 flex flex-col gap-4 flex-1">
          {/* Column headers */}
          <div className="grid grid-cols-[2.5rem_1fr_2rem_1fr] items-center gap-2">
            <div />
            <p className="text-[11px] font-bold text-center text-muted-foreground uppercase tracking-wide truncate">{match.t1Name.split('/')[0].trim()}</p>
            <div />
            <p className="text-[11px] font-bold text-center text-muted-foreground uppercase tracking-wide truncate">{match.t2Name.split('/')[0].trim()}</p>
          </div>

          {scores.map((s, i) => (
            <div key={i} className="grid grid-cols-[2.5rem_1fr_2rem_1fr] items-center gap-2">
              <p className="text-[11px] text-muted-foreground font-semibold text-right">S{i + 1}</p>

              {/* Team 1 */}
              <div className="flex items-center justify-center gap-2">
                <button type="button" className={btn} onClick={() => update(i, 't1', -1)}>−</button>
                <p className={cn('text-[32px] font-extrabold w-10 text-center tabular-nums leading-none', s.t1 > s.t2 ? 'text-accent' : 'text-foreground')}>{s.t1}</p>
                <button type="button" className={btn} onClick={() => update(i, 't1', 1)}>+</button>
              </div>

              {/* Separator */}
              <p className="text-[14px] font-bold text-muted-foreground text-center">—</p>

              {/* Team 2 */}
              <div className="flex items-center justify-center gap-2">
                <button type="button" className={btn} onClick={() => update(i, 't2', -1)}>−</button>
                <p className={cn('text-[32px] font-extrabold w-10 text-center tabular-nums leading-none', s.t2 > s.t1 ? 'text-accent' : 'text-foreground')}>{s.t2}</p>
                <button type="button" className={btn} onClick={() => update(i, 't2', 1)}>+</button>
              </div>
            </div>
          ))}

          {/* Add / remove set */}
          <div className="flex gap-3">
            <button type="button"
              className="text-[13px] text-accent font-semibold py-2 px-1"
              onClick={() => setScores(p => [...p, { t1: 0, t2: 0 }])}>
              + Añadir set
            </button>
            {scores.length > 1 && (
              <button type="button"
                className="text-[13px] text-muted-foreground font-semibold py-2 px-1"
                onClick={() => setScores(p => p.slice(0, -1))}>
                − Quitar set
              </button>
            )}
          </div>
        </div>

        {/* Winner badge */}
        {winner && (
          <div className="mx-5 mb-3 px-4 py-3 bg-accent/10 border border-accent/25 rounded-xl shrink-0">
            <p className="text-[14px] font-bold text-accent text-center">Ganador: {winner}</p>
          </div>
        )}

        {error && (
          <p className="mx-5 mb-3 text-[13px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 shrink-0">{error}</p>
        )}

        {/* Actions */}
        <div className="px-5 pb-8 pt-1 flex gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-4 rounded-xl border border-border text-[15px] font-semibold text-muted-foreground bg-background active:bg-muted">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending || !winner}
            className="flex-1 py-4 rounded-xl bg-accent text-accent-foreground text-[15px] font-semibold disabled:opacity-50 active:bg-accent/90">
            {isPending ? 'Guardando…' : match.status === 'finished' ? 'Corregir resultado' : 'Confirmar resultado'}
          </button>
        </div>
      </div>
    </>
  )
}

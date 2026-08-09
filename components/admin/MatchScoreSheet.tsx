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
  const initial: Array<{ t1: string; t2: string }> =
    match.finalScore?.map(s => ({ t1: String(s.vosotros), t2: String(s.rival) })) ?? [{ t1: '', t2: '' }]
  const [scores, setScores] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const parsed = scores.map(s => ({ t1: parseInt(s.t1) || 0, t2: parseInt(s.t2) || 0 }))
  let t1Sets = 0, t2Sets = 0
  for (const s of parsed) {
    if (s.t1 > s.t2) t1Sets++
    else if (s.t2 > s.t1) t2Sets++
  }
  const winner = t1Sets > t2Sets ? match.t1Name : t2Sets > t1Sets ? match.t2Name : null

  const update = (idx: number, team: 't1' | 't2', val: string) => {
    // Allow empty string or digits 0-99
    if (val !== '' && !/^\d{1,2}$/.test(val)) return
    setScores(prev => prev.map((s, i) => i === idx ? { ...s, [team]: val } : s))
  }

  function handleSubmit() {
    if (!winner) { setError('El resultado no tiene ganador claro (sets empatados)'); return }
    setError(null)
    startTransition(async () => {
      const res = await submitMatchResult(match.id, parsed)
      if ('error' in res) { setError(res.error) } else { onSuccess(res.data.allGroupsDone) }
    })
  }

  const inputCls = (winning: boolean) => cn(
    'w-14 h-12 rounded-xl border text-center text-[28px] font-extrabold tabular-nums bg-background outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors',
    winning ? 'text-accent border-accent/40' : 'text-foreground border-border'
  )

  const t1Short = match.t1Name.split('/')[0].trim()
  const t2Short = match.t2Name.split('/')[0].trim()

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl flex flex-col">
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1.5 shrink-0">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Match header */}
        <div className="px-5 pb-3 border-b border-border shrink-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {match.courtName}{match.scheduledAt ? ` · ${formatTime(match.scheduledAt)}` : ''}
          </p>
          <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <p className="text-[14px] font-bold text-foreground leading-tight">{match.t1Name}</p>
            <p className="text-[11px] font-medium text-muted-foreground">vs</p>
            <p className="text-[14px] font-bold text-foreground leading-tight text-right">{match.t2Name}</p>
          </div>
        </div>

        {/* Score inputs */}
        <div className="px-5 py-3 flex flex-col gap-2.5 shrink-0">
          {/* Column headers */}
          <div className="grid grid-cols-[1.5rem_1fr_1.5rem_1fr] items-center gap-2">
            <div />
            <p className="text-[10px] font-bold text-center text-muted-foreground uppercase tracking-wide truncate">{t1Short}</p>
            <div />
            <p className="text-[10px] font-bold text-center text-muted-foreground uppercase tracking-wide truncate">{t2Short}</p>
          </div>

          {scores.map((s, i) => {
            const p = parsed[i]
            const t1Wins = p.t1 > p.t2
            const t2Wins = p.t2 > p.t1
            return (
              <div key={i} className="grid grid-cols-[1.5rem_1fr_1.5rem_1fr] items-center gap-2">
                <p className="text-[10px] text-muted-foreground font-semibold text-right">S{i + 1}</p>
                <div className="flex justify-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0} max={99}
                    value={s.t1}
                    onChange={e => update(i, 't1', e.target.value)}
                    className={inputCls(t1Wins)}
                  />
                </div>
                <p className="text-[13px] font-bold text-muted-foreground text-center">–</p>
                <div className="flex justify-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0} max={99}
                    value={s.t2}
                    onChange={e => update(i, 't2', e.target.value)}
                    className={inputCls(t2Wins)}
                  />
                </div>
              </div>
            )
          })}

          {/* Add / remove set */}
          <div className="flex gap-3 pt-0.5">
            <button type="button"
              className="text-[12px] text-accent font-semibold py-1"
              onClick={() => setScores(p => [...p, { t1: '', t2: '' }])}>
              + Añadir set
            </button>
            {scores.length > 1 && (
              <button type="button"
                className="text-[12px] text-muted-foreground font-semibold py-1"
                onClick={() => setScores(p => p.slice(0, -1))}>
                − Quitar set
              </button>
            )}
          </div>
        </div>

        {/* Winner badge */}
        {winner && (
          <div className="mx-5 mb-2 px-4 py-2 bg-accent/10 border border-accent/25 rounded-xl shrink-0">
            <p className="text-[13px] font-bold text-accent text-center">Ganador: {winner}</p>
          </div>
        )}

        {error && (
          <p className="mx-5 mb-2 text-[12px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 shrink-0">{error}</p>
        )}

        {/* Actions */}
        <div className="px-5 pb-8 pt-1 flex gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-3.5 rounded-xl border border-border text-[14px] font-semibold text-muted-foreground bg-background active:bg-muted">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={isPending || !winner}
            className="flex-1 py-3.5 rounded-xl bg-accent text-accent-foreground text-[14px] font-semibold disabled:opacity-50 active:bg-accent/90">
            {isPending ? 'Guardando…' : match.status === 'finished' ? 'Corregir' : 'Confirmar'}
          </button>
        </div>
      </div>
    </>
  )
}

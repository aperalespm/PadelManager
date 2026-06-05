'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateGroupBracket, updateGroupBracket } from '@/lib/actions/bracket'

interface Props {
  tournamentId: string
  hasMatches: boolean
  schedulePublished: boolean
}

export function GenerateBracketButton({ tournamentId, hasMatches, schedulePublished }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Used only when the user wants to fully regenerate (destructive)
  const [confirmRegen, setConfirmRegen] = useState(false)

  function runGenerate() {
    startTransition(async () => {
      const result = await generateGroupBracket(tournamentId)
      if (result.error) { alert(result.error); return }
      router.refresh()
    })
  }

  function runUpdate() {
    startTransition(async () => {
      const result = await updateGroupBracket(tournamentId)
      if (result.error) { alert(result.error); return }
      router.refresh()
    })
  }

  // ── Schedule not published yet ───────────────────────────────────────────────
  if (!schedulePublished) {
    return (
      <div className="flex items-center gap-2 px-3 py-[7px] bg-muted border border-border rounded-[8px]">
        <span className="text-[12px] text-muted-foreground">
          Confirma el horario antes de generar el cuadro
        </span>
        <a
          href="horario"
          className="px-2.5 py-1 bg-white border border-border text-[12px] font-semibold rounded-[5px] hover:bg-muted transition-colors"
        >
          Ir al horario →
        </a>
      </div>
    )
  }

  // ── First generation ─────────────────────────────────────────────────────────
  if (!hasMatches) {
    return (
      <button
        onClick={runGenerate}
        disabled={isPending}
        className="px-4 py-2 bg-accent text-white text-[13px] font-semibold rounded-[8px] hover:bg-accent/90 disabled:opacity-50 transition-opacity"
      >
        {isPending ? 'Generando...' : 'Generar cuadro'}
      </button>
    )
  }

  // ── Update mode (matches already exist) ──────────────────────────────────────
  if (confirmRegen) {
    return (
      <div className="flex items-center gap-2 px-3 py-[7px] bg-[var(--warning-surface)] border border-[var(--warning)]/30 rounded-[8px]">
        <span className="text-[12px] font-semibold text-[var(--warning)]">
          ¿Regenerar desde cero? Se perderán los partidos actuales.
        </span>
        <button
          onClick={() => { setConfirmRegen(false); runGenerate() }}
          disabled={isPending}
          className="px-2.5 py-1 bg-[var(--warning)] text-white text-[12px] font-semibold rounded-[5px] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? '...' : 'Sí, regenerar'}
        </button>
        <button
          onClick={() => setConfirmRegen(false)}
          className="px-2.5 py-1 bg-white border border-border text-[12px] font-semibold rounded-[5px] hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={runUpdate}
        disabled={isPending}
        className="px-4 py-2 bg-accent text-white text-[13px] font-semibold rounded-[8px] hover:bg-accent/90 disabled:opacity-50 transition-opacity"
      >
        {isPending ? 'Actualizando...' : '+ Añadir nuevos inscritos'}
      </button>
      <button
        onClick={() => setConfirmRegen(true)}
        disabled={isPending}
        className="px-3 py-2 border border-border text-foreground text-[13px] font-semibold rounded-[8px] hover:bg-muted disabled:opacity-50 transition-colors"
      >
        ↺ Regenerar
      </button>
    </div>
  )
}

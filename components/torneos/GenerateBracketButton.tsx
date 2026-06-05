'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateGroupBracket } from '@/lib/actions/bracket'

interface Props {
  tournamentId: string
  hasMatches: boolean
}

export function GenerateBracketButton({ tournamentId, hasMatches }: Props) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()

  function run() {
    startTransition(async () => {
      setConfirming(false)
      const result = await generateGroupBracket(tournamentId)
      if (result.error) {
        alert(result.error)
        return
      }
      router.refresh()
    })
  }

  if (!hasMatches) {
    return (
      <button
        onClick={run}
        disabled={isPending}
        className="px-4 py-2 bg-accent text-white text-[13px] font-semibold rounded-[8px] hover:bg-accent/90 disabled:opacity-50 transition-opacity"
      >
        {isPending ? 'Generando...' : 'Generar cuadro'}
      </button>
    )
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 px-3 py-[7px] bg-[var(--warning-surface)] border border-[var(--warning)]/30 rounded-[8px]">
        <span className="text-[12px] font-semibold text-[var(--warning)]">¿Regenerar cuadro? Se perderán los partidos actuales.</span>
        <button
          onClick={run}
          disabled={isPending}
          className="px-2.5 py-1 bg-[var(--warning)] text-white text-[12px] font-semibold rounded-[5px] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? '...' : 'Sí, actualizar'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2.5 py-1 bg-white border border-border text-[12px] font-semibold rounded-[5px] hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={isPending}
      className="px-4 py-2 border border-border text-foreground text-[13px] font-semibold rounded-[8px] hover:bg-muted disabled:opacity-50 transition-colors"
    >
      ↺ Actualizar cuadro
    </button>
  )
}

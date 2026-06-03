'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDraftTournament } from '@/lib/actions/tournaments'

export function CreateTournamentButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    startTransition(async () => {
      const result = await createDraftTournament()
      if (result.data) router.push(`/admin/${result.data.id}/config`)
    })
  }

  return (
    <button
      onClick={handleCreate}
      disabled={isPending}
      className="mt-2 px-6 py-3 bg-accent text-white rounded-[8px] text-[14px] font-semibold hover:bg-accent/90 transition-colors disabled:opacity-60"
    >
      {isPending ? 'Creando...' : '+ Crear torneo'}
    </button>
  )
}

'use client'

import { useRouter } from 'next/navigation'

export function CreateTournamentButton() {
  const router = useRouter()

  function handleCreate() {
    router.push('/admin/nuevo')
  }

  return (
    <button
      onClick={handleCreate}
      className="mt-2 px-6 py-3 bg-accent text-white rounded-[8px] text-[14px] font-semibold hover:bg-accent/90 transition-colors"
    >
      + Crear torneo
    </button>
  )
}

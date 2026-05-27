'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validateScore } from '@/lib/actions/matches'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Check, X } from 'lucide-react'

const mockRivalName = 'Roberto Sánchez / Diego Fdez'
const mockScore = [
  { vosotros: 3, rival: 6 },
  { vosotros: 5, rival: 7 },
]

export default function ValidarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleValidate(confirm: boolean) {
    setLoading(true)
    try {
      await validateScore('current', confirm)
      router.push('/mi-torneo')
    } finally {
      setLoading(false)
    }
  }

  const rivalWins = mockScore.filter(s => s.rival > s.vosotros).length
  const ourWins = mockScore.filter(s => s.vosotros > s.rival).length
  const rivalWinsMatch = rivalWins > ourWins

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">{mockRivalName} ha enviado</p>
        <button onClick={() => router.back()} className="flex items-center gap-1 mt-0.5">
          <ChevronLeft className="w-5 h-5 text-foreground" />
          <span className="text-lg font-bold text-foreground">Validar resultado</span>
        </button>
      </header>

      <div className="max-w-sm mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Rival banner */}
        <div className="bg-[var(--warning)] text-[var(--warning-foreground)] rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide opacity-80 mb-1">Resultado introducido por el rival</p>
          <p className="font-bold text-base">{mockRivalName}</p>
        </div>

        {/* Set scores */}
        {mockScore.map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">{i + 1}er set</p>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">VOSOTROS</p>
                <p className="text-3xl font-bold text-accent">{s.vosotros}</p>
              </div>
              <span className="text-xl text-muted-foreground">—</span>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">RIVAL</p>
                <p className="text-3xl font-bold text-[var(--warning)]">{s.rival}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Result summary */}
        <div className="bg-[var(--warning-surface)] rounded-xl p-3 text-center">
          <p className="text-sm text-[var(--warning)] font-medium">
            Resultado: {mockRivalName.split('/')[0].trim()} gana {rivalWins}–{ourWins}
          </p>
        </div>

        <p className="text-sm text-foreground text-center font-medium">¿Confirmas este resultado?</p>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => handleValidate(true)}
            disabled={loading}
            className="w-full bg-[var(--success)] text-[var(--success-foreground)] hover:bg-[var(--success)]/90"
          >
            <Check className="w-4 h-4 mr-2" />
            Sí, confirmar resultado
          </Button>
          <Button
            onClick={() => handleValidate(false)}
            disabled={loading}
            variant="outline"
            className="w-full border-[var(--warning)] text-[var(--warning)] hover:bg-[var(--warning-surface)]"
          >
            <X className="w-4 h-4 mr-2" />
            No, disputar resultado
          </Button>
        </div>
      </div>
    </div>
  )
}

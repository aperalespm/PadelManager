'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validateScore } from '@/lib/actions/matches'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Check, X } from 'lucide-react'

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

  const mockScore = [
    { vosotros: 3, rival: 6 },
    { vosotros: 5, rival: 7 },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">Rival ha enviado</p>
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="w-4 h-4" />
          <span className="font-bold text-lg text-foreground">Validar resultado</span>
        </button>
      </header>

      <div className="max-w-sm mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="bg-[var(--warning)] text-[var(--warning-foreground)] rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide opacity-80 mb-1">Resultado introducido por el rival</p>
          <p className="font-bold">Rival</p>
        </div>

        {mockScore.map((s, i) => (
          <div key={i} className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
            <span className="text-sm text-muted-foreground">{i + 1}º set</span>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">VOSOTROS</p>
                <p className="text-2xl font-bold text-accent">{s.vosotros}</p>
              </div>
              <span className="text-muted-foreground">—</span>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">RIVAL</p>
                <p className="text-2xl font-bold text-[var(--warning)]">{s.rival}</p>
              </div>
            </div>
          </div>
        ))}

        <div className="bg-[var(--warning-surface)] rounded-xl p-3 text-center">
          <p className="text-sm text-[var(--warning)] font-medium">Resultado: Rival gana 2–0</p>
          <p className="text-sm text-muted-foreground mt-1">¿Confirmas este resultado?</p>
        </div>

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

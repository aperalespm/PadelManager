'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitScore } from '@/lib/actions/matches'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

function ScoreInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      min="0"
      max="99"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-16 h-16 text-2xl font-bold text-center rounded-xl border-2 border-border bg-card text-foreground focus:outline-none focus:border-accent"
    />
  )
}

function PlayerAvatar({ initials, name, label, accent }: { initials: string; name: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      <div className={cn(
        'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold',
        accent ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
      )}>
        {initials}
      </div>
      <p className="text-xs text-muted-foreground text-center">{name}</p>
      <p className="text-xs font-medium text-center" style={{ color: accent ? 'var(--accent)' : undefined }}>
        {label}
      </p>
    </div>
  )
}

export default function ResultadoPage() {
  const router = useRouter()
  const [sets, setSets] = useState([{ vosotros: '', rival: '' }, { vosotros: '', rival: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateSet(index: number, field: 'vosotros' | 'rival', value: string) {
    setSets(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  async function handleSubmit() {
    const filledSets = sets.filter(s => s.vosotros !== '' && s.rival !== '')
    if (!filledSets.length) {
      setError('Introduce al menos un set')
      return
    }
    setLoading(true)
    setError('')
    try {
      await submitScore({
        match_id: 'current',
        score: filledSets.map(s => ({ vosotros: parseInt(s.vosotros), rival: parseInt(s.rival) })),
      })
      router.push('/mi-torneo')
    } catch {
      setError('Error al enviar resultado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">Octavos · Pista 3</p>
        <button onClick={() => router.back()} className="flex items-center gap-1 mt-0.5">
          <ChevronLeft className="w-5 h-5 text-foreground" />
          <span className="text-lg font-bold text-foreground">Introducir resultado</span>
        </button>
      </header>

      <div className="max-w-sm mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Team avatars */}
        <div className="flex items-start justify-around gap-4">
          <PlayerAvatar initials="AP" name="Andrés Perales / Joanna Nofav" label="Tu pareja" accent />
          <div className="flex items-center justify-center w-8 mt-5 text-muted-foreground font-bold text-lg">vs</div>
          <PlayerAvatar initials="RS" name="Roberto Sánchez / Diego Fdez" label="Rival" />
        </div>

        {/* Set inputs */}
        {sets.map((set, i) => (
          <div key={i} className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground text-center">
              {i + 1}º Set
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">VOSOTROS</span>
                <ScoreInput value={set.vosotros} onChange={v => updateSet(i, 'vosotros', v)} />
              </div>
              <span className="text-2xl text-muted-foreground mt-5">—</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">RIVAL</span>
                <ScoreInput value={set.rival} onChange={v => updateSet(i, 'rival', v)} />
              </div>
            </div>
          </div>
        ))}

        {error && <p className="text-sm text-[var(--error)] text-center">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {loading ? 'Enviando...' : 'Enviar resultado'}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTournament, publishTournament, saveTournamentPhases } from '@/lib/actions/tournaments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const steps = ['Datos básicos', 'Instalación y formato', 'Fases y puntuación']

export function TournamentCreateForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [tournamentId, setTournamentId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Step 1 fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Step 2 fields
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [category, setCategory] = useState('3ª')
  const [format, setFormat] = useState('elimination')
  const [maxPlayers, setMaxPlayers] = useState('16')
  const [registrationType, setRegistrationType] = useState('pair')
  const [priceInfo, setPriceInfo] = useState('')

  // Step 3 fields
  const [phases, setPhases] = useState([
    { name: 'Fase única', format: 'sets', score_config: { sets: 3 } }
  ])

  async function handleStep1() {
    if (!name || !startDate) { setError('Nombre y fecha de inicio son obligatorios'); return }
    startTransition(async () => {
      setError('')
      const result = await createTournament({
        name,
        description: description || undefined,
        venue_name: venueName || 'Por confirmar',
        venue_address: venueAddress || 'Por confirmar',
        category,
        format: format as 'elimination' | 'round_robin' | 'groups_elimination',
        registration_type: registrationType as 'pair' | 'individual',
        max_players: parseInt(maxPlayers),
        price_info: priceInfo || undefined,
        start_date: new Date(startDate).toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
      })
      if ('error' in result) { setError(result.error as string); return }
      setTournamentId((result.data as Record<string, unknown>).id as string)
      setStep(1)
    })
  }

  async function handleStep2() {
    if (!venueName) { setError('El nombre de la instalación es obligatorio'); return }
    if (tournamentId) {
      startTransition(async () => {
        setError('')
        // Update with venue info
        setStep(2)
      })
    } else {
      setStep(2)
    }
  }

  async function handlePublish() {
    if (!tournamentId) return
    startTransition(async () => {
      setError('')
      await saveTournamentPhases(tournamentId, phases)
      const result = await publishTournament(tournamentId)
      if ('error' in result) { setError(result.error as string); return }
      router.push(`/admin/${tournamentId}`)
    })
  }

  async function handleSaveDraft() {
    if (tournamentId) {
      router.push(`/admin/${tournamentId}`)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold',
              i <= step ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {i + 1}
            </div>
            <span className={cn('text-sm', i === step ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {s}
            </span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

      {/* Step 0: Basic data */}
      {step === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Nombre del torneo *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Open Leganés #1" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Fecha de inicio *</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Fecha de fin</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe el torneo..." />
          </div>
        </div>
      )}

      {/* Step 1: Venue & format */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-xl p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Nombre de la instalación *</Label>
            <Input value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="Padelton Leganés" />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label>Dirección</Label>
            <Input value={venueAddress} onChange={e => setVenueAddress(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['1ª', '2ª', '3ª', '4ª', 'Mixta', 'Abierta'].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Formato</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="elimination">Eliminación directa</SelectItem>
                <SelectItem value="round_robin">Round Robin / Americano</SelectItem>
                <SelectItem value="groups_elimination">Grupos + eliminatoria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Plazas máximas</Label>
            <Input type="number" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Precio informativo</Label>
            <Input value={priceInfo} onChange={e => setPriceInfo(e.target.value)} placeholder="15 €" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tipo de inscripción</Label>
            <Select value={registrationType} onValueChange={setRegistrationType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pair">Pareja</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Step 2: Phases */}
      {step === 2 && (
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <h3 className="font-semibold text-foreground">Fases del torneo</h3>
          {phases.map((phase, i) => (
            <div key={i} className="border border-border rounded-lg p-4 grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Nombre de la fase</Label>
                <Input
                  value={phase.name}
                  onChange={e => setPhases(prev => prev.map((p, idx) => idx === i ? { ...p, name: e.target.value } : p))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Formato de marcador</Label>
                <Select
                  value={phase.format}
                  onValueChange={v => setPhases(prev => prev.map((p, idx) => idx === i ? { ...p, format: v } : p))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sets">Sets (p.ej. 6-4, 7-5)</SelectItem>
                    <SelectItem value="games">Games</SelectItem>
                    <SelectItem value="points">Puntos</SelectItem>
                    <SelectItem value="winner_only">Solo ganador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => setPhases(prev => [...prev, { name: `Fase ${prev.length + 1}`, format: 'sets', score_config: { sets: 3 } }])}
          >
            + Añadir fase
          </Button>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={!tournamentId}
        >
          Guardar borrador
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>Anterior</Button>
          )}
          {step < 2 ? (
            <Button
              onClick={step === 0 ? handleStep1 : handleStep2}
              disabled={isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isPending ? 'Guardando...' : 'Siguiente'}
            </Button>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isPending ? 'Publicando...' : 'Publicar torneo'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

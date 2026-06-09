'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createTournamentFromWizard } from '@/lib/actions/tournaments'
import { findOptimalFormat, type PhaseDurations } from '@/lib/schedule/generator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface WizardData {
  name: string
  startDate: string
  endDate: string
  courts: Array<{ name: string }>
  startTime: string
  endTime: string
  transitionMins: number
  hasLunch: boolean
  lunchTime: string
  lunchDuration: number
  categories: Array<{ name: string; genders: string[] }>
  phaseDurations: PhaseDurations
  minGroups: number
  minTeamsPerGroup: number
  teamsAdvancePerGroup: number
  minMatchesPerTeam: number
}

const DEFAULT: WizardData = {
  name: '',
  startDate: '',
  endDate: '',
  courts: [{ name: 'Pista 1' }, { name: 'Pista 2' }],
  startTime: '10:00',
  endTime: '21:00',
  transitionMins: 10,
  hasLunch: false,
  lunchTime: '14:00',
  lunchDuration: 60,
  categories: [{ name: '1ª', genders: ['M', 'F'] }],
  phaseDurations: { groups: 60, roundOf16: 75, quarterFinal: 75, semiFinal: 90, final: 90 },
  minGroups: 2,
  minTeamsPerGroup: 4,
  teamsAdvancePerGroup: 2,
  minMatchesPerTeam: 2,
}

const STEP_LABELS = ['Datos básicos', 'Pistas y horario', 'Categorías y fases', 'Resumen']

const GENDERS = [
  { key: 'M', label: 'Masculino' },
  { key: 'F', label: 'Femenino' },
  { key: 'Mixto', label: 'Mixto' },
]

const PHASE_ROWS: Array<[keyof PhaseDurations, string]> = [
  ['groups', 'Fase de grupos'],
  ['roundOf16', 'Octavos de final'],
  ['quarterFinal', 'Cuartos de final'],
  ['semiFinal', 'Semifinal'],
  ['final', 'Final'],
]

function toMins(t: string) {
  const [h = 0, m = 0] = t.split(':').map(Number)
  return h * 60 + m
}

function knockoutPhaseList(knockTeams: number): string[] {
  const out: string[] = []
  let n = knockTeams
  while (n >= 2) {
    out.push(n === 2 ? 'Final' : n === 4 ? 'Semifinal' : n === 8 ? 'Cuartos de final' : n === 16 ? 'Octavos de final' : `Ronda de ${n}`)
    n = Math.ceil(n / 2)
  }
  return out
}

export function TournamentWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>(DEFAULT)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = <K extends keyof WizardData>(key: K, value: WizardData[K]) =>
    setData(prev => ({ ...prev, [key]: value }))

  function addCourt() {
    setData(prev => ({ ...prev, courts: [...prev.courts, { name: `Pista ${prev.courts.length + 1}` }] }))
  }
  function removeCourt(i: number) {
    setData(prev => ({ ...prev, courts: prev.courts.filter((_, j) => j !== i) }))
  }
  function updateCourt(i: number, name: string) {
    setData(prev => {
      const courts = [...prev.courts]
      courts[i] = { name }
      return { ...prev, courts }
    })
  }

  function addCategory() {
    setData(prev => ({ ...prev, categories: [...prev.categories, { name: '', genders: ['M', 'F'] }] }))
  }
  function removeCategory(i: number) {
    setData(prev => ({ ...prev, categories: prev.categories.filter((_, j) => j !== i) }))
  }
  function updateCategoryName(i: number, name: string) {
    setData(prev => {
      const categories = [...prev.categories]
      categories[i] = { ...categories[i], name }
      return { ...prev, categories }
    })
  }
  function toggleGender(i: number, g: string) {
    setData(prev => {
      const categories = [...prev.categories]
      const genders = categories[i].genders.includes(g)
        ? categories[i].genders.filter(x => x !== g)
        : [...categories[i].genders, g]
      categories[i] = { ...categories[i], genders }
      return { ...prev, categories }
    })
  }
  function updatePhaseDuration(key: keyof PhaseDurations, val: number) {
    setData(prev => ({ ...prev, phaseDurations: { ...prev.phaseDurations, [key]: isNaN(val) ? 0 : val } }))
  }

  const expandedCats = useMemo(() =>
    data.categories.flatMap(c =>
      c.genders.length === 0
        ? [c.name || '?']
        : c.genders.map(g => `${c.name || '?'} ${g === 'M' ? 'Masc.' : g === 'F' ? 'Fem.' : g}`)
    ), [data.categories])

  const preview = useMemo(() => {
    const startM = toMins(data.startTime)
    const endM = toMins(data.endTime)
    const lunchM = data.hasLunch ? data.lunchDuration : 0
    const availableM = Math.max(0, endM - startM - lunchM)
    const groupSlot = (data.phaseDurations.groups || 60) + data.transitionMins
    const slotsPerCourt = groupSlot > 0 ? Math.floor(availableM / groupSlot) : 0
    const totalSlots = slotsPerCourt * Math.max(1, data.courts.length)
    const numCats = Math.max(1, expandedCats.length)
    const opt = findOptimalFormat(totalSlots, data.minGroups, data.minTeamsPerGroup, data.teamsAdvancePerGroup, data.minMatchesPerTeam, numCats)
    const knockTeams = opt.numGroups * data.teamsAdvancePerGroup
    return { ...opt, slotsPerCourt, knockPhases: knockoutPhaseList(knockTeams) }
  }, [data, expandedCats])

  function canGoNext() {
    if (step === 0) return data.name.trim().length > 0 && data.startDate.length > 0
    if (step === 1) return data.courts.length > 0 && toMins(data.startTime) < toMins(data.endTime)
    if (step === 2) return data.categories.length > 0 && data.categories.every(c => c.name.trim().length > 0)
    return true
  }

  async function handleCreate() {
    setIsCreating(true)
    setError(null)
    try {
      const result = await createTournamentFromWizard(data)
      if ('error' in result) { setError(result.error); return }
      router.push(`/admin/${result.data.tournamentId}/horario`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={cn(
              'flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0 transition-colors',
              i <= step ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'
            )}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={cn('text-[12px] font-medium whitespace-nowrap', i === step ? 'text-foreground' : 'text-muted-foreground')}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn('h-px w-6 shrink-0', i < step ? 'bg-accent' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">

        {step === 0 && (
          <>
            <div>
              <Label htmlFor="w-name" className="text-sm font-medium">Nombre del torneo *</Label>
              <Input
                id="w-name"
                value={data.name}
                onChange={e => update('name', e.target.value)}
                placeholder="Open de Primavera 2026"
                className="mt-1.5"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="w-start" className="text-sm font-medium">Fecha de inicio *</Label>
                <Input id="w-start" type="date" value={data.startDate} onChange={e => update('startDate', e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="w-end" className="text-sm font-medium">Fecha de fin</Label>
                <Input id="w-end" type="date" value={data.endDate} onChange={e => update('endDate', e.target.value)} className="mt-1.5" />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Pistas</Label>
                <button onClick={addCourt} className="text-[12px] font-medium text-accent hover:underline">
                  + Añadir pista
                </button>
              </div>
              <div className="space-y-2">
                {data.courts.map((court, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={court.name} onChange={e => updateCourt(i, e.target.value)} placeholder={`Pista ${i + 1}`} className="flex-1" />
                    {data.courts.length > 1 && (
                      <button onClick={() => removeCourt(i)} className="w-8 h-8 flex items-center justify-center rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-lg">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Inicio</Label>
                <Input type="time" value={data.startTime} onChange={e => update('startTime', e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-sm font-medium">Fin</Label>
                <Input type="time" value={data.endTime} onChange={e => update('endTime', e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-sm font-medium">Transición (min)</Label>
                <Input type="number" min={0} max={60} value={data.transitionMins} onChange={e => update('transitionMins', parseInt(e.target.value) || 0)} className="mt-1.5" />
              </div>
            </div>

            <div className="p-4 border border-border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Pausa de almuerzo</p>
                  <p className="text-[12px] text-muted-foreground">El horario saltará este bloque automáticamente</p>
                </div>
                <Switch checked={data.hasLunch} onCheckedChange={v => update('hasLunch', v)} />
              </div>
              {data.hasLunch && (
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <Label className="text-xs text-muted-foreground">Hora de inicio</Label>
                    <Input type="time" value={data.lunchTime} onChange={e => update('lunchTime', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Duración (min)</Label>
                    <Input type="number" min={15} value={data.lunchDuration} onChange={e => update('lunchDuration', parseInt(e.target.value) || 60)} className="mt-1" />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Categorías</Label>
                <button onClick={addCategory} className="text-[12px] font-medium text-accent hover:underline">
                  + Añadir categoría
                </button>
              </div>
              <div className="space-y-2">
                {data.categories.map((cat, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                    <Input
                      value={cat.name}
                      onChange={e => updateCategoryName(i, e.target.value)}
                      placeholder="Ej: 1ª, 2ª…"
                      className="w-28 shrink-0"
                    />
                    <div className="flex items-center gap-1.5 flex-1">
                      {GENDERS.map(g => (
                        <button
                          key={g.key}
                          onClick={() => toggleGender(i, g.key)}
                          className={cn(
                            'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
                            cat.genders.includes(g.key)
                              ? 'bg-accent text-white border-accent'
                              : 'text-muted-foreground border-border hover:border-accent/50 hover:text-foreground'
                          )}
                        >
                          {g.label}
                        </button>
                      ))}
                      {cat.genders.length === 0 && (
                        <span className="text-[11px] text-muted-foreground italic">Open (sin división)</span>
                      )}
                    </div>
                    {data.categories.length > 1 && (
                      <button onClick={() => removeCategory(i)} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 text-lg">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Duración de partidos por ronda (minutos)</Label>
              <div className="mt-3 space-y-2">
                {PHASE_ROWS.map(([key, label]) => (
                  <div key={key} className="flex items-center gap-4">
                    <span className="text-[13px] text-muted-foreground w-44 shrink-0">{label}</span>
                    <Input
                      type="number" min={10} max={300}
                      value={data.phaseDurations[key]}
                      onChange={e => updatePhaseDuration(key, parseInt(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-[12px] text-muted-foreground">min</span>
                  </div>
                ))}
              </div>
            </div>

            <details className="border border-border rounded-lg overflow-hidden">
              <summary className="px-4 py-3 text-[13px] font-medium cursor-pointer hover:bg-muted/50 select-none list-none flex items-center justify-between">
                <span>Ajustes avanzados de formato</span>
                <span className="text-muted-foreground text-[11px]">opcional</span>
              </summary>
              <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/20 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[12px] text-muted-foreground">Mín. grupos por categoría</Label>
                  <Input type="number" min={1} max={20} value={data.minGroups} onChange={e => update('minGroups', parseInt(e.target.value) || 1)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[12px] text-muted-foreground">Mín. parejas por grupo</Label>
                  <Input type="number" min={2} max={10} value={data.minTeamsPerGroup} onChange={e => update('minTeamsPerGroup', parseInt(e.target.value) || 2)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[12px] text-muted-foreground">Parejas que pasan por grupo</Label>
                  <Input type="number" min={1} max={10} value={data.teamsAdvancePerGroup} onChange={e => update('teamsAdvancePerGroup', parseInt(e.target.value) || 1)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[12px] text-muted-foreground">Mín. partidos por pareja</Label>
                  <Input type="number" min={1} max={10} value={data.minMatchesPerTeam} onChange={e => update('minMatchesPerTeam', parseInt(e.target.value) || 1)} className="mt-1" />
                </div>
              </div>
            </details>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h2 className="text-xl font-bold text-foreground">{data.name}</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {data.startDate}{data.endDate && data.endDate !== data.startDate ? ` → ${data.endDate}` : ''}
              </p>
            </div>

            {/* Capacity cards */}
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: 'Pistas', value: data.courts.length },
                { label: 'Parejas / categoría', value: preview.maxPairsPerCategory || '—' },
                { label: 'Partidos totales', value: preview.totalMatches },
              ] as { label: string; value: number | string }[]).map(({ label, value }) => (
                <div key={label} className="bg-[var(--accent-surface)] border border-accent/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-accent">{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Format summary */}
            <div className="p-4 bg-muted/40 rounded-lg space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Formato</span>
                <span className="font-medium">{preview.numGroups} grupos × {preview.teamsPerGroup} parejas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categorías</span>
                <span className="font-medium">{expandedCats.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horario</span>
                <span className="font-medium">{data.startTime}–{data.endTime}{data.hasLunch ? ` · almuerzo ${data.lunchTime}` : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transición</span>
                <span className="font-medium">{data.transitionMins} min entre partidos</span>
              </div>
            </div>

            {/* Phases */}
            <div>
              <p className="text-[12px] font-medium text-muted-foreground mb-2">Fases generadas</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-[var(--accent-surface)] text-accent border border-accent/20">
                  Fase de grupos
                </span>
                {preview.knockPhases.map(p => (
                  <span key={p} className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-muted text-foreground border border-border">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Category list */}
            {expandedCats.length > 0 && (
              <div>
                <p className="text-[12px] font-medium text-muted-foreground mb-2">Categorías ({expandedCats.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {expandedCats.map(cat => (
                    <Badge key={cat} variant="outline" className="text-[11px]">{cat}</Badge>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-[var(--error-surface,#fef2f2)] border border-[var(--error,#ef4444)]/30 rounded-lg text-[13px] text-[var(--error,#ef4444)]">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
          Anterior
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canGoNext()}>
            Siguiente
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="bg-accent text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creando…
              </span>
            ) : 'Crear torneo y generar horario'}
          </Button>
        )}
      </div>
    </div>
  )
}

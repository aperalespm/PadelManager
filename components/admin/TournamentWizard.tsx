'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createTournamentFromWizard } from '@/lib/actions/tournaments'
import { type PhaseDurations } from '@/lib/schedule/generator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { NumberStepper } from '@/components/ui/number-stepper'
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
    setData(prev => {
      const maxN = prev.categories.reduce((m, c) => { const n = c.name.match(/^(\d+)/); return n ? Math.max(m, parseInt(n[1])) : m }, 0)
      return { ...prev, categories: [...prev.categories, { name: `${maxN + 1}ª`, genders: ['M', 'F'] }] }
    })
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
  function bulkToggleGender(g: string) {
    const all = data.categories.every(c => c.genders.includes(g))
    setData(prev => ({
      ...prev,
      categories: prev.categories.map(c => ({
        ...c,
        genders: all ? c.genders.filter(x => x !== g) : c.genders.includes(g) ? c.genders : [...c.genders, g],
      })),
    }))
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
                <NumberStepper min={0} max={60} value={data.transitionMins} onChange={v => update('transitionMins', v)} className="mt-1.5" />
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
                    <NumberStepper min={15} max={480} step={15} value={data.lunchDuration} onChange={v => update('lunchDuration', v)} className="mt-1" />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* ── Categorías ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Categorías</Label>
                <button onClick={addCategory} className="text-[12px] font-medium text-accent hover:underline">
                  + Añadir categoría
                </button>
              </div>

              {/* Column headers */}
              <div className="grid items-center mb-1 px-3 gap-x-3" style={{ gridTemplateColumns: '1fr 80px 80px 72px 28px' }}>
                <span />
                {GENDERS.map(g => (
                  <span key={g.key} className="text-[11px] font-medium text-muted-foreground text-center">{g.label}</span>
                ))}
                <span />
              </div>

              {/* Bulk row */}
              <div className="grid items-center px-3 py-2 bg-muted/40 rounded-lg mb-2 gap-x-3" style={{ gridTemplateColumns: '1fr 80px 80px 72px 28px' }}>
                <span className="text-[12px] text-muted-foreground">Para todas</span>
                {GENDERS.map(g => {
                  const all = data.categories.every(c => c.genders.includes(g.key))
                  const some = data.categories.some(c => c.genders.includes(g.key))
                  return (
                    <div key={g.key} className="flex justify-center">
                      <Checkbox
                        checked={all ? true : some ? 'indeterminate' : false}
                        onCheckedChange={() => bulkToggleGender(g.key)}
                      />
                    </div>
                  )
                })}
                <span />
              </div>

              {/* Category rows */}
              <div className="space-y-1.5">
                {data.categories.map((cat, i) => (
                  <div key={i} className="grid items-center px-3 py-2.5 border border-border rounded-lg gap-x-3" style={{ gridTemplateColumns: '1fr 80px 80px 72px 28px' }}>
                    <Input
                      value={cat.name}
                      onChange={e => updateCategoryName(i, e.target.value)}
                      placeholder="Ej: 1ª, 2ª…"
                      className="h-8 text-[13px]"
                    />
                    {GENDERS.map(g => (
                      <div key={g.key} className="flex justify-center">
                        <Checkbox
                          checked={cat.genders.includes(g.key)}
                          onCheckedChange={() => toggleGender(i, g.key)}
                        />
                      </div>
                    ))}
                    <div className="flex justify-center">
                      {data.categories.length > 1 && (
                        <button onClick={() => removeCategory(i)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-base leading-none">
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Duración por ronda ── */}
            <div>
              <Label className="text-sm font-medium">Duración de partidos por ronda (minutos)</Label>
              <div className="mt-3 space-y-2">
                {PHASE_ROWS.map(([key, label]) => (
                  <div key={key} className="flex items-center gap-4">
                    <span className="text-[13px] text-muted-foreground w-44 shrink-0">{label}</span>
                    <NumberStepper
                      min={10}
                      max={300}
                      step={5}
                      value={data.phaseDurations[key]}
                      onChange={v => updatePhaseDuration(key, v)}
                      className="w-36"
                    />
                    <span className="text-[12px] text-muted-foreground">min</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Formato ── */}
            <div>
              <Label className="text-sm font-medium mb-3">Formato</Label>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[12px] text-muted-foreground">Mín. grupos por categoría</Label>
                  <NumberStepper min={1} max={20} value={data.minGroups} onChange={v => update('minGroups', v)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[12px] text-muted-foreground">Mín. parejas por grupo</Label>
                  <NumberStepper min={2} max={10} value={data.minTeamsPerGroup} onChange={v => update('minTeamsPerGroup', v)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[12px] text-muted-foreground">Parejas que pasan por grupo</Label>
                  <NumberStepper min={1} max={10} value={data.teamsAdvancePerGroup} onChange={v => update('teamsAdvancePerGroup', v)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[12px] text-muted-foreground">Mín. partidos por pareja</Label>
                  <NumberStepper min={1} max={10} value={data.minMatchesPerTeam} onChange={v => update('minMatchesPerTeam', v)} className="mt-1" />
                </div>
              </div>
            </div>
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
                { label: 'Categorías', value: expandedCats.length },
                { label: 'Mín. parejas/cat.', value: data.minGroups * data.minTeamsPerGroup },
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
                <span className="text-muted-foreground">Formato mínimo</span>
                <span className="font-medium">≥ {data.minGroups} grupo{data.minGroups !== 1 ? 's' : ''} × {data.minTeamsPerGroup} parejas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pasan por grupo</span>
                <span className="font-medium">{data.teamsAdvancePerGroup} pareja{data.teamsAdvancePerGroup !== 1 ? 's' : ''}</span>
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
              <p className="text-[12px] font-medium text-muted-foreground mb-2">Fases (mínimo configurado)</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-[var(--accent-surface)] text-accent border border-accent/20">
                  Fase de grupos
                </span>
                {knockoutPhaseList(data.minGroups * data.teamsAdvancePerGroup).map(p => (
                  <span key={p} className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-muted text-foreground border border-border">
                    {p}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">El generador puede crear más grupos si el tiempo disponible lo permite.</p>
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

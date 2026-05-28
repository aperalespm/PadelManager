'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTournament, saveTournamentPhases } from '@/lib/actions/tournaments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface TournamentConfigFormProps {
  tournament: Record<string, unknown>
}

const SERVICE_LABELS: [string, string][] = [
  ['bar',        'Bar / Cafetería'],
  ['vestuarios', 'Vestuarios'],
  ['parking',    'Parking'],
  ['tienda',     'Tienda'],
  ['duchas',     'Duchas'],
]

const PHASE_NAMES = ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final']

function FieldRow({ label, req, note, children }: { label: string; req?: boolean; note?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] font-semibold text-foreground mb-1.5">
        {label}{req && <span className="text-[var(--error)] ml-0.5">*</span>}
      </label>
      {children}
      {note && <p className="text-[11px] text-muted-foreground mt-1.5">{note}</p>}
    </div>
  )
}

function StyledInput({ value, onChange, type, placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type ?? 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
    />
  )
}

function StyledSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
    >
      {children}
    </select>
  )
}

export function TournamentConfigForm({ tournament: t }: TournamentConfigFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState('datos')
  const [error, setError] = useState('')

  // Datos básicos
  const [name, setName] = useState(t.name as string ?? '')
  const [description, setDescription] = useState(t.description as string ?? '')
  const [maxPlayers, setMaxPlayers] = useState(String(t.max_players ?? 32))
  const [priceInfo, setPriceInfo] = useState(t.price_info as string ?? '')
  const [registrationType, setRegistrationType] = useState(t.registration_type as string ?? 'pair')
  const [startDate, setStartDate] = useState(
    t.start_date ? new Date(t.start_date as string).toISOString().split('T')[0] : ''
  )
  const [endDate, setEndDate] = useState(
    t.end_date ? new Date(t.end_date as string).toISOString().split('T')[0] : ''
  )
  const [cancelDeadline, setCancelDeadline] = useState(
    t.cancel_deadline ? new Date(t.cancel_deadline as string).toISOString().split('T')[0] : ''
  )

  // Instalación — stored in venue_details JSONB
  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const [venueName, setVenueName] = useState(t.venue_name as string ?? '')
  const [venueAddress, setVenueAddress] = useState(t.venue_address as string ?? '')
  const [courtCount, setCourtCount] = useState(String(vd.court_count ?? '6'))
  const [courtType, setCourtType] = useState(vd.court_type as string ?? 'indoor')
  const [surface, setSurface] = useState(vd.surface as string ?? 'cesped')
  const [services, setServices] = useState<Record<string, boolean>>(
    (vd.services as Record<string, boolean>) ?? { bar: false, vestuarios: false, parking: false, tienda: false, duchas: false }
  )

  // Categorías y formato
  const [categories, setCategories] = useState<string[]>(
    (vd.categories as string[]) ?? ['1ª categoría', '2ª categoría', '3ª categoría']
  )
  const [format, setFormat] = useState(t.format as string ?? 'elimination')

  // Puntuación
  const [activePhaseIdx, setActivePhaseIdx] = useState(0)
  const [phases, setPhases] = useState(
    PHASE_NAMES.map(name => ({ name, scoring: 'sets', sets: '3', tiebreak: 'tiebreak7', thirdSet: 'complete', scoreType: 'sets_games' }))
  )

  function updatePhase(idx: number, key: string, value: string) {
    setPhases(ps => ps.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }

  function handleSave() {
    startTransition(async () => {
      setError('')
      const venueDetails = {
        court_count: parseInt(courtCount) || null,
        court_type: courtType,
        surface,
        services,
        categories,
      }
      const result = await updateTournament(t.id as string, {
        name,
        description: description || undefined,
        max_players: parseInt(maxPlayers),
        price_info: priceInfo || undefined,
        registration_type: registrationType as 'pair' | 'individual',
        format: format as 'elimination' | 'round_robin' | 'groups_elimination',
        venue_name: venueName || undefined,
        venue_address: venueAddress || undefined,
        venue_details: venueDetails,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        cancel_deadline: cancelDeadline ? new Date(cancelDeadline).toISOString() : undefined,
      })
      if ('error' in result) { setError(result.error as string); return }

      await saveTournamentPhases(t.id as string, phases.map(p => ({
        name: p.name,
        format: p.scoring,
        score_config: { sets: parseInt(p.sets), tiebreak: p.tiebreak, third_set: p.thirdSet, score_type: p.scoreType },
      })))
      router.refresh()
    })
  }

  const tabs = [
    { id: 'datos',      label: 'Datos básicos' },
    { id: 'instalacion',label: 'Instalación' },
    { id: 'categorias', label: 'Categorías y formato' },
    { id: 'puntuacion', label: 'Puntuación' },
  ]

  return (
    <div className="flex flex-col gap-[20px] max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground tracking-[-0.5px]">Configuración</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{t.name as string}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => router.back()}
            className="px-[17px] py-[9px] bg-white border border-border rounded-[7px] text-[13px] font-semibold text-foreground cursor-pointer hover:bg-[#f8fafc] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-[17px] py-[9px] bg-accent rounded-[7px] text-[13px] font-semibold text-white cursor-pointer hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {error && <p className="text-[13px] text-[var(--error)]">{error}</p>}

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-border rounded-[10px] p-[5px]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 py-[9px] px-3 rounded-[7px] text-[12px] font-medium transition-all',
              tab === t.id
                ? 'bg-accent text-white font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Datos básicos */}
      {tab === 'datos' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">
          <FieldRow label="Nombre del torneo" req>
            <StyledInput value={name} onChange={setName} />
          </FieldRow>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Fecha de inicio" req>
              <StyledInput type="date" value={startDate} onChange={setStartDate} />
            </FieldRow>
            <FieldRow label="Fecha de fin" req>
              <StyledInput type="date" value={endDate} onChange={setEndDate} />
            </FieldRow>
          </div>
          <FieldRow label="Descripción">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </FieldRow>
          <FieldRow label="Logo / Imagen de portada">
            <div className="border-2 border-dashed border-border rounded-lg p-7 text-center bg-[var(--muted)] cursor-pointer">
              <div className="text-[26px] mb-2">🖼</div>
              <p className="text-[13px] text-muted-foreground">Arrastra aquí o <span className="text-accent font-semibold">selecciona un archivo</span></p>
              <p className="text-[11px] text-light mt-1">PNG, JPG, SVG · máx. 8 MB</p>
            </div>
          </FieldRow>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Plazas máximas" req>
              <StyledInput type="number" value={maxPlayers} onChange={setMaxPlayers} />
            </FieldRow>
            <FieldRow label="Precio (informativo)">
              <StyledInput value={priceInfo} onChange={setPriceInfo} placeholder="15 €" />
            </FieldRow>
          </div>
          <FieldRow label="Tipo de inscripción" req>
            <StyledSelect value={registrationType} onChange={setRegistrationType}>
              <option value="pair">Pareja — inscripción conjunta</option>
              <option value="individual">Individual — el sistema empareja</option>
            </StyledSelect>
          </FieldRow>
          <FieldRow label="Fecha límite de cancelación" note="Después de esta fecha solo el organizador puede cancelar">
            <StyledInput type="date" value={cancelDeadline} onChange={setCancelDeadline} />
          </FieldRow>
        </div>
      )}

      {/* Tab: Instalación */}
      {tab === 'instalacion' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">
          <FieldRow label="Nombre de la instalación" req>
            <StyledInput value={venueName} onChange={setVenueName} placeholder="Padelton Leganés" />
          </FieldRow>
          <FieldRow label="Dirección" req>
            <StyledInput value={venueAddress} onChange={setVenueAddress} placeholder="Calle de las Pistas 12, Leganés" />
          </FieldRow>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Número de pistas" req>
              <StyledInput type="number" value={courtCount} onChange={setCourtCount} placeholder="6" />
            </FieldRow>
            <FieldRow label="Tipo de pista" req>
              <StyledSelect value={courtType} onChange={setCourtType}>
                <option value="indoor">Indoor (cristal)</option>
                <option value="outdoor">Outdoor</option>
                <option value="mixed">Mixta</option>
              </StyledSelect>
            </FieldRow>
          </div>
          <FieldRow label="Superficie">
            <StyledSelect value={surface} onChange={setSurface}>
              <option value="cesped">Césped artificial</option>
              <option value="moqueta">Moqueta</option>
            </StyledSelect>
          </FieldRow>

          {/* Services */}
          <div>
            <p className="text-[12px] font-semibold text-foreground mb-2.5">Servicios disponibles</p>
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_LABELS.map(([key, label]) => {
                const active = services[key]
                return (
                  <label
                    key={key}
                    onClick={() => setServices(s => ({ ...s, [key]: !s[key] }))}
                    className={cn(
                      'flex items-center gap-2 px-3 py-[9px] rounded-[7px] border cursor-pointer text-[12px] transition-colors select-none',
                      active
                        ? 'border-accent bg-[var(--accent-surface)] text-accent font-semibold'
                        : 'border-border bg-white text-muted-foreground font-normal'
                    )}
                  >
                    <span className={cn(
                      'w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] shrink-0',
                      active ? 'bg-accent border-accent text-white' : 'bg-white border-border'
                    )}>
                      {active ? '✓' : ''}
                    </span>
                    {label}
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Categorías y formato */}
      {tab === 'categorias' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">
          {/* Categories */}
          <div className="mb-5">
            <p className="text-[12px] font-semibold text-foreground mb-2.5">
              Categorías <span className="text-[var(--error)]">*</span>
            </p>
            <div className="flex flex-col gap-2">
              {categories.map((cat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={cat}
                    onChange={e => setCategories(cs => cs.map((c, j) => j === i ? e.target.value : c))}
                    className="flex-1 px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button
                    onClick={() => setCategories(cs => cs.filter((_, j) => j !== i))}
                    className="w-7 h-7 bg-[var(--error)] text-white rounded-[5px] text-xs font-bold flex items-center justify-center shrink-0 hover:bg-[var(--error-hover)] transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setCategories(cs => [...cs, `${cs.length + 1}ª categoría`])}
                className="self-start px-3 py-[5px] border border-border rounded-[7px] bg-white text-[12px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors"
              >
                + Añadir categoría
              </button>
            </div>
          </div>

          <div className="h-px bg-border my-5" />

          <FieldRow label="Formato del torneo" req>
            <StyledSelect value={format} onChange={setFormat}>
              <option value="elimination">Eliminación directa</option>
              <option value="groups_elimination">Fase de grupos + Eliminatoria</option>
              <option value="american">Americano (todos contra todos)</option>
              <option value="round_robin">Round Robin (liga)</option>
            </StyledSelect>
          </FieldRow>

          {/* Phase config box */}
          <div className="bg-[var(--muted)] border border-border rounded-lg p-4 mt-1">
            <p className="text-[12px] font-semibold text-foreground mb-3">Configuración de fases</p>
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Fase de grupos">
                <StyledSelect value="4x4" onChange={() => {}}>
                  <option value="4x4">4 grupos de 4 equipos</option>
                  <option value="2x8">2 grupos de 8 equipos</option>
                </StyledSelect>
              </FieldRow>
              <FieldRow label="Equipos que pasan">
                <StyledSelect value="top2" onChange={() => {}}>
                  <option value="top2">Los 2 primeros de cada grupo</option>
                  <option value="top1">El primero de cada grupo</option>
                </StyledSelect>
              </FieldRow>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Puntuación */}
      {tab === 'puntuacion' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">
          {/* Phase pills */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {phases.map((ph, i) => (
              <button
                key={i}
                onClick={() => setActivePhaseIdx(i)}
                className={cn(
                  'px-[14px] py-[7px] rounded-[7px] border text-[12px] cursor-pointer transition-colors',
                  activePhaseIdx === i
                    ? 'border-accent bg-[var(--accent-surface)] text-accent font-semibold'
                    : 'border-border bg-white text-muted-foreground font-medium hover:border-accent/40'
                )}
              >
                {ph.name}
              </button>
            ))}
          </div>

          {/* Scoring config */}
          <div className="grid grid-cols-2 gap-4" key={activePhaseIdx}>
            <FieldRow label="Tipo de puntuación">
              <StyledSelect value={phases[activePhaseIdx].scoring} onChange={v => updatePhase(activePhaseIdx, 'scoring', v)}>
                <option value="sets">Sets completos</option>
                <option value="games">Games</option>
                <option value="points">Puntos</option>
                <option value="winner">Solo ganador</option>
              </StyledSelect>
            </FieldRow>
            <FieldRow label="Al mejor de X sets">
              <StyledSelect value={phases[activePhaseIdx].sets} onChange={v => updatePhase(activePhaseIdx, 'sets', v)}>
                <option value="1">1 set</option>
                <option value="3">Al mejor de 3</option>
                <option value="5">Al mejor de 5</option>
              </StyledSelect>
            </FieldRow>
            <FieldRow label="Games por set">
              <StyledInput value="" onChange={() => {}} placeholder="ej. 6" />
            </FieldRow>
            <FieldRow label="Games iguales (6-6)">
              <StyledSelect value={phases[activePhaseIdx].tiebreak} onChange={v => updatePhase(activePhaseIdx, 'tiebreak', v)}>
                <option value="tiebreak7">Tiebreak a 7 puntos</option>
                <option value="supertb10">Super tiebreak a 10</option>
                <option value="golden">Punto de oro</option>
                <option value="none">Sin iguales</option>
              </StyledSelect>
            </FieldRow>
            <FieldRow label="3er set (si al mejor de 3)">
              <StyledSelect value={phases[activePhaseIdx].thirdSet} onChange={v => updatePhase(activePhaseIdx, 'thirdSet', v)}>
                <option value="complete">Set completo</option>
                <option value="supertb10">Super tiebreak a 10</option>
                <option value="na">No aplica</option>
              </StyledSelect>
            </FieldRow>
            <FieldRow label="Marcador a registrar">
              <StyledSelect value={phases[activePhaseIdx].scoreType} onChange={v => updatePhase(activePhaseIdx, 'scoreType', v)}>
                <option value="sets_games">Sets y games</option>
                <option value="winner_only">Solo ganador</option>
                <option value="full_points">Puntos completos</option>
              </StyledSelect>
            </FieldRow>
          </div>

          {/* Info note */}
          <div className="mt-2 px-[14px] py-3 bg-[var(--accent-surface)] rounded-[7px] text-[12px] text-accent">
            💡 Puedes configurar una puntuación distinta para cada fase del torneo.
          </div>
        </div>
      )}
    </div>
  )
}

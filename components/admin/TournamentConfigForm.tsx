'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTournament, saveTournamentPhases } from '@/lib/actions/tournaments'
import { cn } from '@/lib/utils'

interface TournamentConfigFormProps {
  tournament: Record<string, unknown>
}

const DEFAULT_SERVICES = [
  { key: 'bar',        label: 'Bar / Cafetería' },
  { key: 'vestuarios', label: 'Vestuarios' },
  { key: 'parking',    label: 'Parking' },
  { key: 'tienda',     label: 'Tienda' },
  { key: 'duchas',     label: 'Duchas' },
  { key: 'piscina',    label: 'Piscina' },
]

const PHASE_NAMES = ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final']

type Service  = { key: string; label: string; active: boolean }
type Category = { name: string; minScore: string; maxScore: string }

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

function SI({ value, onChange, type, placeholder, className }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string }) {
  return (
    <input
      type={type ?? 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn('w-full px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent', className)}
    />
  )
}

function SS({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
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

function FormatConfig({ format, maxPlayers }: { format: string; maxPlayers: number }) {
  const [groups, setGroups] = useState('4')
  const [perGroup, setPerGroup] = useState('4')
  const [advance, setAdvance] = useState('2')
  const [thirdPlace, setThirdPlace] = useState('no')
  const [seeding, setSeeding] = useState('random')
  const [matchDuration, setMatchDuration] = useState('30')
  const [winPts, setWinPts] = useState('3')
  const [drawPts, setDrawPts] = useState('1')
  const [tiebreak, setTbCrit] = useState('game_diff')

  const phases: string[] = []
  if (format === 'elimination') {
    let n = maxPlayers
    const pnames = ['Final', 'Semifinal', 'Cuartos de final', 'Octavos de final', 'Dieciseisavos']
    while (n > 1) { phases.unshift(pnames[Math.min(Math.floor(Math.log2(n)) - 1, pnames.length - 1)] || `Ronda de ${n}`); n = Math.ceil(n / 2) }
  }

  return (
    <div className="bg-[var(--muted)] border border-border rounded-lg p-4 mt-1">
      <p className="text-[12px] font-semibold text-foreground mb-3">Configuración de fases</p>

      {format === 'elimination' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Emparejamiento">
              <SS value={seeding} onChange={setSeeding}>
                <option value="random">Aleatorio</option>
                <option value="seeded">Por cabezas de serie</option>
              </SS>
            </FieldRow>
            <FieldRow label="Partido 3er y 4to puesto">
              <SS value={thirdPlace} onChange={setThirdPlace}>
                <option value="no">No</option>
                <option value="yes">Sí</option>
              </SS>
            </FieldRow>
          </div>
          {phases.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5">Fases generadas con {maxPlayers} participantes:</p>
              <div className="flex flex-wrap gap-1.5">
                {phases.map(ph => (
                  <span key={ph} className="px-2.5 py-1 bg-white border border-border rounded-full text-[11px] text-foreground font-medium">{ph}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {format === 'groups_elimination' && (
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Número de grupos">
            <SS value={groups} onChange={setGroups}>
              <option value="2">2 grupos</option>
              <option value="4">4 grupos</option>
              <option value="8">8 grupos</option>
            </SS>
          </FieldRow>
          <FieldRow label="Equipos por grupo">
            <SS value={perGroup} onChange={setPerGroup}>
              <option value="4">4 equipos</option>
              <option value="6">6 equipos</option>
              <option value="8">8 equipos</option>
            </SS>
          </FieldRow>
          <FieldRow label="Equipos que pasan por grupo">
            <SS value={advance} onChange={setAdvance}>
              <option value="1">El 1º de cada grupo</option>
              <option value="2">Los 2 primeros de cada grupo</option>
              <option value="3">Los 3 primeros de cada grupo</option>
            </SS>
          </FieldRow>
          <FieldRow label="Fase eliminatoria desde">
            <SS value={seeding} onChange={setSeeding}>
              <option value="qf">Cuartos de final</option>
              <option value="sf">Semifinal</option>
              <option value="r16">Octavos de final</option>
            </SS>
          </FieldRow>
        </div>
      )}

      {format === 'american' && (
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Duración por partido (min)">
            <SI value={matchDuration} onChange={setMatchDuration} type="number" placeholder="30" />
          </FieldRow>
          <FieldRow label="Rotación de parejas">
            <SS value={seeding} onChange={setSeeding}>
              <option value="random">Aleatoria</option>
              <option value="fixed">Fija por ronda</option>
            </SS>
          </FieldRow>
          <FieldRow label="Puntos por victoria">
            <SI value={winPts} onChange={setWinPts} type="number" placeholder="3" />
          </FieldRow>
          <FieldRow label="Puntos por derrota">
            <SI value={drawPts} onChange={setDrawPts} type="number" placeholder="0" />
          </FieldRow>
        </div>
      )}

      {format === 'round_robin' && (
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Puntos por victoria">
            <SS value={winPts} onChange={setWinPts}>
              <option value="3">3 puntos</option>
              <option value="2">2 puntos</option>
            </SS>
          </FieldRow>
          <FieldRow label="Puntos por empate">
            <SS value={drawPts} onChange={setDrawPts}>
              <option value="1">1 punto</option>
              <option value="0">0 puntos</option>
            </SS>
          </FieldRow>
          <FieldRow label="Puntos por derrota">
            <SI value="0" onChange={() => {}} type="number" className="bg-[var(--muted)] text-muted-foreground cursor-not-allowed" />
          </FieldRow>
          <FieldRow label="Criterio de desempate">
            <SS value={tiebreak} onChange={setTbCrit}>
              <option value="game_diff">Diferencia de juegos</option>
              <option value="head_to_head">Enfrentamiento directo</option>
              <option value="sets_won">Sets ganados</option>
              <option value="points_diff">Diferencia de puntos</option>
            </SS>
          </FieldRow>
        </div>
      )}
    </div>
  )
}

export function TournamentConfigForm({ tournament: t }: TournamentConfigFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState('datos')
  const [error, setError] = useState('')

  // ── Datos básicos ─────────────────────────────────────────────
  const [name, setName]           = useState(t.name as string ?? '')
  const [description, setDesc]    = useState(t.description as string ?? '')
  const [maxPlayers, setMax]      = useState(String(t.max_players ?? 32))
  const [priceInfo, setPrice]     = useState(t.price_info as string ?? '')
  const [regType, setRegType]     = useState(t.registration_type as string ?? 'pair')
  const [startDate, setStart]     = useState(t.start_date ? new Date(t.start_date as string).toISOString().split('T')[0] : '')
  const [endDate, setEnd]         = useState(t.end_date   ? new Date(t.end_date   as string).toISOString().split('T')[0] : '')
  const [cancelDl, setCancel]     = useState(t.cancel_deadline ? new Date(t.cancel_deadline as string).toISOString().split('T')[0] : '')

  // ── Instalación ───────────────────────────────────────────────
  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const [venueName, setVName]     = useState(t.venue_name    as string ?? '')
  const [venueAddr, setVAddr]     = useState(t.venue_address as string ?? '')
  const [courtCount, setCourts]   = useState(String(vd.court_count ?? '6'))
  const [courtType, setCType]     = useState(vd.court_type as string ?? 'indoor')
  const [surface, setSurface]     = useState(vd.surface    as string ?? 'cesped')
  const savedServices             = vd.services as Service[] | undefined
  const [serviceList, setServices] = useState<Service[]>(
    Array.isArray(savedServices)
      ? savedServices
      : DEFAULT_SERVICES.map(s => ({ ...s, active: false }))
  )
  const [newSvcName, setNewSvc]   = useState('')

  // ── Categorías y formato ──────────────────────────────────────
  const savedCats = vd.categories as Category[] | undefined
  const [categories, setCategories] = useState<Category[]>(
    Array.isArray(savedCats) && savedCats.length > 0 && typeof savedCats[0] === 'object'
      ? savedCats
      : ['1ª categoría', '2ª categoría', '3ª categoría'].map(n => ({ name: n, minScore: '', maxScore: '' }))
  )
  const [format, setFormat]       = useState(t.format as string ?? 'elimination')

  // ── Puntuación ────────────────────────────────────────────────
  const [activePhaseIdx, setPhaseIdx] = useState(0)
  const [phases, setPhases] = useState(
    PHASE_NAMES.map(n => ({ name: n, scoring: 'sets', sets: '3', tiebreak: 'tiebreak7', thirdSet: 'complete', scoreType: 'sets_games' }))
  )
  function updatePhase(idx: number, key: string, value: string) {
    setPhases(ps => ps.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }

  // ── Save ──────────────────────────────────────────────────────
  function handleSave() {
    startTransition(async () => {
      setError('')
      const result = await updateTournament(t.id as string, {
        name,
        description:       description || undefined,
        max_players:       parseInt(maxPlayers),
        price_info:        priceInfo || undefined,
        registration_type: regType as 'pair' | 'individual',
        format:            format as 'elimination' | 'round_robin' | 'groups_elimination',
        venue_name:        venueName  || undefined,
        venue_address:     venueAddr  || undefined,
        venue_details: {
          court_count: parseInt(courtCount) || null,
          court_type:  courtType,
          surface,
          services:    serviceList,
          categories,
        },
        start_date:     startDate  ? new Date(startDate).toISOString()  : undefined,
        end_date:       endDate    ? new Date(endDate).toISOString()    : undefined,
        cancel_deadline: cancelDl  ? new Date(cancelDl).toISOString()  : undefined,
      })
      if ('error' in result) { setError(result.error as string); return }
      await saveTournamentPhases(t.id as string, phases.map(p => ({
        name:         p.name,
        format:       p.scoring,
        score_config: { sets: parseInt(p.sets), tiebreak: p.tiebreak, third_set: p.thirdSet, score_type: p.scoreType },
      })))
      router.refresh()
    })
  }

  const TABS = [
    { id: 'datos',      label: 'Datos básicos' },
    { id: 'instalacion',label: 'Instalación' },
    { id: 'categorias', label: 'Categorías y formato' },
    { id: 'puntuacion', label: 'Puntuación' },
  ]

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground tracking-[-0.5px]">Configuración</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{t.name as string}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => router.back()} className="px-[17px] py-[9px] bg-white border border-border rounded-[7px] text-[13px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isPending} className="px-[17px] py-[9px] bg-accent rounded-[7px] text-[13px] font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50">
            {isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {error && <p className="text-[13px] text-[var(--error)]">{error}</p>}

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-border rounded-[10px] p-[5px]">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={cn('flex-1 py-[9px] px-3 rounded-[7px] text-[12px] font-medium transition-all',
              tab === tb.id ? 'bg-accent text-white font-bold' : 'text-muted-foreground hover:text-foreground'
            )}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Datos básicos ────────────────────────────────── */}
      {tab === 'datos' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">
          <FieldRow label="Nombre del torneo" req><SI value={name} onChange={setName} /></FieldRow>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Fecha de inicio" req><SI type="date" value={startDate} onChange={setStart} /></FieldRow>
            <FieldRow label="Fecha de fin" req><SI type="date" value={endDate} onChange={setEnd} /></FieldRow>
          </div>
          <FieldRow label="Descripción">
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3}
              className="w-full px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-accent" />
          </FieldRow>
          <FieldRow label="Logo / Imagen de portada">
            <div className="border-2 border-dashed border-border rounded-lg p-7 text-center bg-[var(--muted)] cursor-pointer">
              <div className="text-[26px] mb-2">🖼</div>
              <p className="text-[13px] text-muted-foreground">Arrastra aquí o <span className="text-accent font-semibold">selecciona un archivo</span></p>
              <p className="text-[11px] text-light mt-1">PNG, JPG, SVG · máx. 8 MB</p>
            </div>
          </FieldRow>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Plazas máximas" req><SI type="number" value={maxPlayers} onChange={setMax} /></FieldRow>
            <FieldRow label="Precio (informativo)"><SI value={priceInfo} onChange={setPrice} placeholder="15 €" /></FieldRow>
          </div>
          <FieldRow label="Tipo de inscripción" req>
            <SS value={regType} onChange={setRegType}>
              <option value="pair">Pareja — inscripción conjunta</option>
              <option value="individual">Individual — el sistema empareja</option>
            </SS>
          </FieldRow>
          <FieldRow label="Fecha límite de cancelación" note="Después de esta fecha solo el organizador puede cancelar">
            <SI type="date" value={cancelDl} onChange={setCancel} />
          </FieldRow>
        </div>
      )}

      {/* ── Tab: Instalación ──────────────────────────────────── */}
      {tab === 'instalacion' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">
          <FieldRow label="Nombre de la instalación" req><SI value={venueName} onChange={setVName} placeholder="Padelton Leganés" /></FieldRow>
          <FieldRow label="Dirección" req><SI value={venueAddr} onChange={setVAddr} placeholder="Calle de las Pistas 12, Leganés" /></FieldRow>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Número de pistas" req><SI type="number" value={courtCount} onChange={setCourts} placeholder="6" /></FieldRow>
            <FieldRow label="Tipo de pista" req>
              <SS value={courtType} onChange={setCType}>
                <option value="indoor">Indoor (cristal)</option>
                <option value="outdoor">Outdoor</option>
                <option value="mixed">Mixta</option>
              </SS>
            </FieldRow>
          </div>
          <FieldRow label="Superficie">
            <SS value={surface} onChange={setSurface}>
              <option value="cesped">Césped artificial</option>
              <option value="moqueta">Moqueta</option>
            </SS>
          </FieldRow>

          {/* Services */}
          <div>
            <p className="text-[12px] font-semibold text-foreground mb-2.5">Servicios disponibles</p>
            <div className="grid grid-cols-3 gap-2">
              {serviceList.map((svc, i) => (
                <label key={svc.key} onClick={() => setServices(sl => sl.map((s, j) => j === i ? { ...s, active: !s.active } : s))}
                  className={cn(
                    'flex items-center gap-2 px-3 py-[9px] rounded-[7px] border cursor-pointer text-[12px] transition-colors select-none',
                    svc.active ? 'border-accent bg-[var(--accent-surface)] text-accent font-semibold' : 'border-border bg-white text-muted-foreground'
                  )}>
                  <span className={cn('w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] shrink-0',
                    svc.active ? 'bg-accent border-accent text-white' : 'bg-white border-border')}>
                    {svc.active ? '✓' : ''}
                  </span>
                  {svc.label}
                </label>
              ))}
            </div>

            {/* Add custom service */}
            <div className="flex gap-2 mt-3">
              <input
                value={newSvcName}
                onChange={e => setNewSvc(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newSvcName.trim()) {
                    setServices(sl => [...sl, { key: newSvcName.toLowerCase().replace(/\s+/g, '_'), label: newSvcName.trim(), active: true }])
                    setNewSvc('')
                  }
                }}
                placeholder="Añadir otro servicio..."
                className="flex-1 px-3 py-[7px] border border-border rounded-[7px] text-[12px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                onClick={() => {
                  if (!newSvcName.trim()) return
                  setServices(sl => [...sl, { key: newSvcName.toLowerCase().replace(/\s+/g, '_'), label: newSvcName.trim(), active: true }])
                  setNewSvc('')
                }}
                className="px-3 py-[7px] bg-white border border-border rounded-[7px] text-[12px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors"
              >
                + Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Categorías y formato ─────────────────────────── */}
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
                  {/* Name */}
                  <input
                    value={cat.name}
                    onChange={e => setCategories(cs => cs.map((c, j) => j === i ? { ...c, name: e.target.value } : c))}
                    placeholder="Nombre de la categoría"
                    className="flex-1 px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  {/* Score range */}
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      value={cat.minScore}
                      onChange={e => setCategories(cs => cs.map((c, j) => j === i ? { ...c, minScore: e.target.value } : c))}
                      placeholder="3.5"
                      className="w-14 px-2 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground text-center focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <span className="text-[12px] text-muted-foreground">—</span>
                    <input
                      value={cat.maxScore}
                      onChange={e => setCategories(cs => cs.map((c, j) => j === i ? { ...c, maxScore: e.target.value } : c))}
                      placeholder="4.25"
                      className="w-14 px-2 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground text-center focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  {/* Delete */}
                  <button
                    onClick={() => setCategories(cs => cs.filter((_, j) => j !== i))}
                    className="w-7 h-7 bg-[var(--error)] text-white rounded-[5px] text-xs font-bold flex items-center justify-center shrink-0 hover:bg-[var(--error-hover)] transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setCategories(cs => [...cs, { name: `${cs.length + 1}ª categoría`, minScore: '', maxScore: '' }])}
                className="self-start px-3 py-[5px] border border-border rounded-[7px] bg-white text-[12px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors"
              >
                + Añadir categoría
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Intervalo de puntuación opcional (ej. 3.5 — 4.25)</p>
          </div>

          <div className="h-px bg-border my-5" />

          <FieldRow label="Formato del torneo" req>
            <SS value={format} onChange={setFormat}>
              <option value="elimination">Eliminación directa</option>
              <option value="groups_elimination">Fase de grupos + Eliminatoria</option>
              <option value="american">Americano (todos contra todos)</option>
              <option value="round_robin">Round Robin (liga)</option>
            </SS>
          </FieldRow>

          <FormatConfig format={format} maxPlayers={parseInt(maxPlayers) || 16} />
        </div>
      )}

      {/* ── Tab: Puntuación ───────────────────────────────────── */}
      {tab === 'puntuacion' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">
          {/* Phase pills */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {phases.map((ph, i) => (
              <button key={i} onClick={() => setPhaseIdx(i)}
                className={cn('px-[14px] py-[7px] rounded-[7px] border text-[12px] cursor-pointer transition-colors',
                  activePhaseIdx === i ? 'border-accent bg-[var(--accent-surface)] text-accent font-semibold' : 'border-border bg-white text-muted-foreground font-medium hover:border-accent/40'
                )}>
                {ph.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4" key={activePhaseIdx}>
            <FieldRow label="Tipo de puntuación">
              <SS value={phases[activePhaseIdx].scoring} onChange={v => updatePhase(activePhaseIdx, 'scoring', v)}>
                <option value="sets">Sets completos</option>
                <option value="games">Games</option>
                <option value="points">Puntos</option>
                <option value="winner">Solo ganador</option>
              </SS>
            </FieldRow>
            <FieldRow label="Al mejor de X sets">
              <SS value={phases[activePhaseIdx].sets} onChange={v => updatePhase(activePhaseIdx, 'sets', v)}>
                <option value="1">1 set</option>
                <option value="3">Al mejor de 3</option>
                <option value="5">Al mejor de 5</option>
              </SS>
            </FieldRow>
            <FieldRow label="Games por set"><SI value="" onChange={() => {}} placeholder="ej. 6" /></FieldRow>
            <FieldRow label="Games iguales (6-6)">
              <SS value={phases[activePhaseIdx].tiebreak} onChange={v => updatePhase(activePhaseIdx, 'tiebreak', v)}>
                <option value="tiebreak7">Tiebreak a 7 puntos</option>
                <option value="supertb10">Super tiebreak a 10</option>
                <option value="golden">Punto de oro</option>
                <option value="none">Sin iguales</option>
              </SS>
            </FieldRow>
            <FieldRow label="3er set (si al mejor de 3)">
              <SS value={phases[activePhaseIdx].thirdSet} onChange={v => updatePhase(activePhaseIdx, 'thirdSet', v)}>
                <option value="complete">Set completo</option>
                <option value="supertb10">Super tiebreak a 10</option>
                <option value="na">No aplica</option>
              </SS>
            </FieldRow>
            <FieldRow label="Marcador a registrar">
              <SS value={phases[activePhaseIdx].scoreType} onChange={v => updatePhase(activePhaseIdx, 'scoreType', v)}>
                <option value="sets_games">Sets y games</option>
                <option value="winner_only">Solo ganador</option>
                <option value="full_points">Puntos completos</option>
              </SS>
            </FieldRow>
          </div>

          <div className="mt-2 px-[14px] py-3 bg-[var(--accent-surface)] rounded-[7px] text-[12px] text-accent">
            💡 Puedes configurar una puntuación distinta para cada fase del torneo.
          </div>
        </div>
      )}
    </div>
  )
}

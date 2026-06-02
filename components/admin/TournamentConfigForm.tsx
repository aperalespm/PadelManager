'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTournament, saveTournamentPhases } from '@/lib/actions/tournaments'
import { cn } from '@/lib/utils'

interface TournamentConfigFormProps {
  tournament: Record<string, unknown>
}

// ── Types ────────────────────────────────────────────────────────────────────

type Service  = { key: string; label: string; active: boolean }
type Category = { name: string; minScore: string; maxScore: string }
type Court    = { name: string }
type TimeBlock = { id: string; courtName: string; from: string; to: string; reason: string }

interface MatchConfig {
  sets_format: string
  games_to_win_set: number
  deuce_mode: string
  deciding_set_format: string
  tiebreak_points: number
  super_tiebreak_points: number
  time_limit_minutes: string
}

interface PhaseConfig {
  name: string
  match_config: MatchConfig
}

interface FormatState {
  bracket_size: string
  seeding_method: string
  has_third_place_match: boolean
  num_groups: string
  teams_per_group: string
  teams_advance_per_group: string
  group_scoring: string
  tiebreak_criteria: string[]
  time_limit_minutes: string
  bracket_seeding: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_SERVICES = [
  { key: 'bar',        label: 'Bar / Cafetería' },
  { key: 'vestuarios', label: 'Vestuarios' },
  { key: 'parking',    label: 'Parking' },
  { key: 'tienda',     label: 'Tienda' },
  { key: 'duchas',     label: 'Duchas' },
  { key: 'piscina',    label: 'Piscina' },
]

const TIEBREAK_CRITERIA_OPTIONS = [
  { value: 'HEAD_TO_HEAD',      label: 'Enfrentamiento directo' },
  { value: 'SET_DIFFERENCE',    label: 'Diferencia de sets' },
  { value: 'GAME_DIFFERENCE',   label: 'Diferencia de juegos' },
  { value: 'GAMES_WON',         label: 'Juegos ganados' },
  { value: 'POINTS_DIFFERENCE', label: 'Diferencia de puntos' },
  { value: 'RANDOM',            label: 'Desempate aleatorio' },
]

const DEFAULT_TIEBREAK_CRITERIA = ['HEAD_TO_HEAD', 'GAME_DIFFERENCE', 'SET_DIFFERENCE', 'RANDOM']

const DEFAULT_MATCH_CONFIG: MatchConfig = {
  sets_format: 'BEST_OF_3',
  games_to_win_set: 6,
  deuce_mode: 'STAR_POINT',
  deciding_set_format: 'SUPER_TIEBREAK_10',
  tiebreak_points: 7,
  super_tiebreak_points: 10,
  time_limit_minutes: '',
}

const DEFAULT_COURTS: Court[] = [
  { name: 'Pista 1' },
  { name: 'Pista 2' },
  { name: 'Pista 3' },
  { name: 'Pista 4' },
]

function getEliminationPhaseNames(bracketSize: number): string[] {
  const all = [
    { size: 64, name: 'Treintaidosavos de final' },
    { size: 32, name: 'Dieciseisavos de final' },
    { size: 16, name: 'Octavos de final' },
    { size: 8,  name: 'Cuartos de final' },
    { size: 4,  name: 'Semifinal' },
    { size: 2,  name: 'Final' },
  ]
  return all.filter(e => e.size < bracketSize || e.size === 2).map(e => e.name)
}

function getGroupsEliminationPhaseNames(numGroups: number, teamsAdvance: number): string[] {
  const total = numGroups * teamsAdvance
  const phases = ['Fase de grupos']
  if (total > 8)  phases.push('Octavos de final')
  if (total > 4)  phases.push('Cuartos de final')
  if (total > 2)  phases.push('Semifinal')
  phases.push('Final')
  return phases
}

// ── Small UI helpers ──────────────────────────────────────────────────────────

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

function SI({ value, onChange, type, placeholder, className, min, max }: {
  value: string; onChange: (v: string) => void; type?: string
  placeholder?: string; className?: string; min?: string; max?: string
}) {
  return (
    <input
      type={type ?? 'text'} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} min={min} max={max}
      className={cn('w-full px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent', className)}
    />
  )
}

function SS({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent">
      {children}
    </select>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.9px] text-light mb-3">{children}</p>
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" onClick={onToggle}
      className={cn('w-9 h-5 rounded-full transition-colors relative shrink-0', on ? 'bg-accent' : 'bg-border')}
    >
      <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}

function Divider() {
  return <div className="h-px bg-border my-1" />
}

// ── Tiebreak Criteria List ────────────────────────────────────────────────────

function TiebreakCriteriaList({ criteria, onChange }: { criteria: string[]; onChange: (c: string[]) => void }) {
  function move(i: number, dir: -1 | 1) {
    const next = [...criteria]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const labelOf = (val: string) => TIEBREAK_CRITERIA_OPTIONS.find(o => o.value === val)?.label ?? val

  return (
    <div className="flex flex-col gap-1.5">
      {criteria.map((c, i) => (
        <div key={c} className="flex items-center gap-2 bg-white border border-border rounded-[7px] px-3 py-[7px]">
          <span className="text-[11px] font-bold text-light w-4 text-center">{i + 1}</span>
          <span className="flex-1 text-[12px] text-foreground font-medium">{labelOf(c)}</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              className="w-6 h-6 flex items-center justify-center rounded border border-border text-[11px] text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === criteria.length - 1}
              className="w-6 h-6 flex items-center justify-center rounded border border-border text-[11px] text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors">↓</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Match Config Panel ────────────────────────────────────────────────────────

function MatchConfigPanel({ config, onChange }: { config: MatchConfig; onChange: (c: MatchConfig) => void }) {
  function set<K extends keyof MatchConfig>(key: K, value: MatchConfig[K]) {
    onChange({ ...config, [key]: value })
  }
  const isBestOf1 = config.sets_format === 'BEST_OF_1'

  return (
    <div className="flex flex-col gap-4">
      <FieldRow label="Formato del partido" req>
        <SS value={config.sets_format} onChange={v => set('sets_format', v)}>
          <option value="BEST_OF_1">1 set</option>
          <option value="BEST_OF_2_SUPERTB">2 sets (super TB si empate)</option>
          <option value="BEST_OF_3">Mejor de 3 sets</option>
        </SS>
      </FieldRow>
      <FieldRow label="Juegos para ganar set" req>
        <SI type="number" value={String(config.games_to_win_set)} onChange={v => set('games_to_win_set', parseInt(v) || 6)} min="1" max="9" placeholder="6" />
      </FieldRow>
      <FieldRow label="Deuce" req>
        <SS value={config.deuce_mode} onChange={v => set('deuce_mode', v)}>
          <option value="ADVANTAGE">Ventaja clásica</option>
          <option value="GOLDEN_POINT">Golden Point</option>
          <option value="STAR_POINT">Star Point (FIP 2026)</option>
        </SS>
      </FieldRow>
      {!isBestOf1 && (
        <FieldRow label="Set decisivo" req>
          <SS value={config.deciding_set_format} onChange={v => set('deciding_set_format', v)}>
            <option value="FULL_SET">Set completo</option>
            <option value="TIEBREAK_7">Tie-break a 7</option>
            <option value="SUPER_TIEBREAK_10">Super tie-break a 10</option>
          </SS>
        </FieldRow>
      )}
      {!isBestOf1 && config.deciding_set_format === 'TIEBREAK_7' && (
        <FieldRow label="Puntos tie-break">
          <SI type="number" value={String(config.tiebreak_points)} onChange={v => set('tiebreak_points', parseInt(v) || 7)} placeholder="7" />
        </FieldRow>
      )}
      {!isBestOf1 && config.deciding_set_format === 'SUPER_TIEBREAK_10' && (
        <FieldRow label="Puntos super tie-break">
          <SI type="number" value={String(config.super_tiebreak_points)} onChange={v => set('super_tiebreak_points', parseInt(v) || 10)} placeholder="10" />
        </FieldRow>
      )}
      <FieldRow label="Límite de tiempo (min)" note="Dejar vacío para sin límite">
        <SI type="number" value={config.time_limit_minutes} onChange={v => set('time_limit_minutes', v)} placeholder="Sin límite" />
      </FieldRow>
      <div className="bg-[var(--accent-surface)] text-accent rounded-[7px] px-4 py-3 text-[12px]">
        ⚠ Star Point es el estándar FIP desde enero 2026. Ventaja clásica y Golden Point son los más habituales en amateur.
      </div>
    </div>
  )
}

// ── Format Config Panel ───────────────────────────────────────────────────────

function FormatConfigPanel({ format, state, onChange }: {
  format: string; state: FormatState; onChange: (s: FormatState) => void
}) {
  function set<K extends keyof FormatState>(key: K, value: FormatState[K]) {
    onChange({ ...state, [key]: value })
  }

  if (format === 'elimination') {
    const phases = getEliminationPhaseNames(parseInt(state.bracket_size) || 16)
    return (
      <div className="bg-[var(--muted)] border border-border rounded-[10px] p-[18px] mt-1 flex flex-col gap-4">
        <SectionLabel>Configuración de eliminación directa</SectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Tamaño del cuadro" req>
            <SS value={state.bracket_size} onChange={v => set('bracket_size', v)}>
              <option value="4">4 parejas</option>
              <option value="8">8 parejas</option>
              <option value="16">16 parejas</option>
              <option value="32">32 parejas</option>
              <option value="64">64 parejas</option>
            </SS>
          </FieldRow>
          <FieldRow label="Método de siembra" req>
            <SS value={state.seeding_method} onChange={v => set('seeding_method', v)}>
              <option value="RANDOM">Aleatorio</option>
              <option value="RANKING">Por ranking</option>
              <option value="MANUAL">Manual</option>
            </SS>
          </FieldRow>
        </div>
        <FieldRow label="Partido 3er y 4to puesto">
          <SS value={state.has_third_place_match ? 'yes' : 'no'} onChange={v => set('has_third_place_match', v === 'yes')}>
            <option value="no">No</option>
            <option value="yes">Sí</option>
          </SS>
        </FieldRow>
        {phases.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-2">Fases generadas:</p>
            <div className="flex flex-wrap gap-1.5">
              {phases.map(ph => (
                <span key={ph} className="px-2.5 py-1 bg-white border border-border rounded-full text-[11px] text-foreground font-medium">{ph}</span>
              ))}
              {state.has_third_place_match && (
                <span className="px-2.5 py-1 bg-white border border-border rounded-full text-[11px] text-foreground font-medium">3er puesto</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (format === 'groups_elimination') {
    const totalKnockout = (parseInt(state.num_groups) || 0) * (parseInt(state.teams_advance_per_group) || 0)
    return (
      <div className="bg-[var(--muted)] border border-border rounded-[10px] p-[18px] mt-1 flex flex-col gap-4">
        <SectionLabel>Configuración de grupos + eliminatoria</SectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Número de grupos" req note="Cualquier número ≥ 1">
            <SI type="number" value={state.num_groups} onChange={v => set('num_groups', v)} min="1" max="32" placeholder="3" />
          </FieldRow>
          <FieldRow label="Equipos por grupo" req>
            <SI type="number" value={state.teams_per_group} onChange={v => set('teams_per_group', v)} min="2" max="10" placeholder="4" />
          </FieldRow>
          <FieldRow label="Equipos que pasan por grupo" req>
            <SS value={state.teams_advance_per_group} onChange={v => set('teams_advance_per_group', v)}>
              <option value="1">1 equipo</option>
              <option value="2">2 equipos</option>
              <option value="3">3 equipos</option>
              <option value="4">4 equipos</option>
            </SS>
          </FieldRow>
          <FieldRow label="Sistema de clasificación" req>
            <SS value={state.group_scoring} onChange={v => set('group_scoring', v)}>
              <option value="WIN_LOSS">Victoria/Derrota</option>
              <option value="GAMES_WON">Juegos ganados</option>
              <option value="SETS_WON">Sets ganados</option>
              <option value="POINTS_SCORED">Puntos</option>
            </SS>
          </FieldRow>
        </div>

        <FieldRow label="Siembra de eliminatorias" req>
          <SS value={state.bracket_seeding} onChange={v => set('bracket_seeding', v)}>
            <option value="CRUZADO">Cruzado — 1ºA vs 2ºB, 1ºB vs 2ºA…</option>
            <option value="RANKING_GLOBAL">Por ranking global de grupos</option>
          </SS>
        </FieldRow>

        {totalKnockout > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-2">
              {totalKnockout} clasificados totales
              {totalKnockout % 2 !== 0 || !Number.isInteger(Math.log2(totalKnockout))
                ? ` · se asignarán ${Math.pow(2, Math.ceil(Math.log2(totalKnockout))) - totalKnockout} BYE${Math.pow(2, Math.ceil(Math.log2(totalKnockout))) - totalKnockout !== 1 ? 's' : ''} automáticos`
                : ''
              }
            </p>
          </div>
        )}

        <div>
          <p className="text-[12px] font-semibold text-foreground mb-2">Criterios de desempate (en orden)</p>
          <TiebreakCriteriaList criteria={state.tiebreak_criteria} onChange={v => set('tiebreak_criteria', v)} />
        </div>
      </div>
    )
  }

  if (format === 'american') {
    return (
      <div className="bg-[var(--muted)] border border-border rounded-[10px] p-[18px] mt-1 flex flex-col gap-4">
        <SectionLabel>Configuración Americano</SectionLabel>
        <FieldRow label="Sistema de clasificación" req>
          <SS value={state.group_scoring} onChange={v => set('group_scoring', v)}>
            <option value="WIN_LOSS">Victoria/Derrota</option>
            <option value="GAMES_WON">Juegos ganados</option>
            <option value="SETS_WON">Sets ganados</option>
            <option value="POINTS_SCORED">Puntos</option>
          </SS>
        </FieldRow>
        <div>
          <p className="text-[12px] font-semibold text-foreground mb-2">Criterios de desempate (en orden)</p>
          <TiebreakCriteriaList criteria={state.tiebreak_criteria} onChange={v => set('tiebreak_criteria', v)} />
        </div>
        <FieldRow label="Límite de tiempo por partido (min)" note="Dejar vacío para sin límite">
          <SI type="number" value={state.time_limit_minutes} onChange={v => set('time_limit_minutes', v)} placeholder="Sin límite" />
        </FieldRow>
      </div>
    )
  }

  return null
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TournamentConfigForm({ tournament: t }: TournamentConfigFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState('datos')
  const [error, setError] = useState('')

  // ── Datos básicos ─────────────────────────────────────────────
  const [name, setName]        = useState(t.name as string ?? '')
  const [description, setDesc] = useState(t.description as string ?? '')
  const [maxPlayers, setMax]   = useState(String(t.max_players ?? 32))
  const [priceInfo, setPrice]  = useState(t.price_info as string ?? '')
  const [regType, setRegType]  = useState(t.registration_type as string ?? 'pair')
  const [startDate, setStart]  = useState(t.start_date ? new Date(t.start_date as string).toISOString().split('T')[0] : '')
  const [endDate, setEnd]      = useState(t.end_date   ? new Date(t.end_date   as string).toISOString().split('T')[0] : '')
  const [cancelDl, setCancel]  = useState(t.cancel_deadline ? new Date(t.cancel_deadline as string).toISOString().split('T')[0] : '')

  // ── Instalación ───────────────────────────────────────────────
  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const [venueName, setVName]  = useState(t.venue_name    as string ?? '')
  const [venueAddr, setVAddr]  = useState(t.venue_address as string ?? '')
  const [courtCount, setCourts]= useState(String(vd.court_count ?? '6'))
  const [courtType, setCType]  = useState(vd.court_type as string ?? 'indoor')
  const [surface, setSurface]  = useState(vd.surface    as string ?? 'cesped')
  const savedServices          = vd.services as Service[] | undefined
  const [serviceList, setServices] = useState<Service[]>(
    Array.isArray(savedServices) ? savedServices : DEFAULT_SERVICES.map(s => ({ ...s, active: false }))
  )
  const [newSvcName, setNewSvc] = useState('')

  // ── Categorías y formato ──────────────────────────────────────
  const savedCats = vd.categories as Category[] | undefined
  const [categories, setCategories] = useState<Category[]>(
    Array.isArray(savedCats) && savedCats.length > 0 && typeof savedCats[0] === 'object'
      ? savedCats
      : ['PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA'].map(n => ({ name: n, minScore: '', maxScore: '' }))
  )
  const [format, setFormat] = useState(t.format as string ?? 'groups_elimination')

  const [formatState, setFormatState] = useState<FormatState>({
    bracket_size:            String(vd.bracket_size ?? '16'),
    seeding_method:          (vd.seeding_method as string) ?? 'RANDOM',
    has_third_place_match:   Boolean(vd.has_third_place_match ?? false),
    num_groups:              String(vd.num_groups ?? '3'),
    teams_per_group:         String(vd.teams_per_group ?? '4'),
    teams_advance_per_group: String(vd.teams_advance_per_group ?? '2'),
    group_scoring:           (vd.scoring_system as string) ?? 'WIN_LOSS',
    tiebreak_criteria:       (vd.tiebreak_criteria as string[]) ?? DEFAULT_TIEBREAK_CRITERIA,
    time_limit_minutes:      String(vd.time_limit_minutes ?? ''),
    bracket_seeding:         (vd.bracket_seeding as string) ?? 'CRUZADO',
  })

  // ── Horario ───────────────────────────────────────────────────
  const savedCourts = vd.courts as Court[] | undefined
  const [namedCourts, setNamedCourts] = useState<Court[]>(
    Array.isArray(savedCourts) && savedCourts.length > 0 ? savedCourts : DEFAULT_COURTS
  )
  const [newCourtName, setNewCourtName] = useState('')

  const sched = (vd.schedule as Record<string, unknown>) ?? {}
  const savedLunch = sched.lunch_break as Record<string, unknown> | null | undefined

  const [schedStart, setSchedStart]       = useState((sched.start_time as string) ?? '10:00')
  const [schedEnd, setSchedEnd]           = useState((sched.end_time   as string) ?? '21:00')
  const [lunchEnabled, setLunchEnabled]   = useState(Boolean(savedLunch))
  const [lunchTime, setLunchTime]         = useState((savedLunch?.time as string) ?? '14:30')
  const [lunchDuration, setLunchDuration] = useState(String(savedLunch?.duration_minutes ?? '60'))

  const savedPhaseDurs = sched.phase_durations as Record<string, number> | undefined
  const [phaseDurations, setPhaseDurations] = useState<Record<string, string>>(
    savedPhaseDurs
      ? Object.fromEntries(Object.entries(savedPhaseDurs).map(([k, v]) => [k, String(v)]))
      : {}
  )

  const savedBlocks = sched.time_blocks as TimeBlock[] | undefined
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>(
    Array.isArray(savedBlocks) ? savedBlocks : []
  )

  const savedAssign = sched.court_assignments as Record<string, string[]> | null | undefined
  const [courtAssignEnabled, setCourtAssignEnabled] = useState(Boolean(savedAssign))
  const [courtAssignments, setCourtAssignments]     = useState<Record<string, string[]>>(savedAssign ?? {})

  // ── Puntuación – per-phase configs ───────────────────────────
  function buildPhasesForFormat(fmt: string, fs: FormatState): PhaseConfig[] {
    let phaseNames: string[] = []
    if (fmt === 'elimination') {
      phaseNames = getEliminationPhaseNames(parseInt(fs.bracket_size) || 16)
      if (fs.has_third_place_match) phaseNames = [...phaseNames, '3er puesto']
    } else if (fmt === 'groups_elimination') {
      phaseNames = getGroupsEliminationPhaseNames(parseInt(fs.num_groups) || 3, parseInt(fs.teams_advance_per_group) || 2)
    } else if (fmt === 'american') {
      phaseNames = ['Todos los partidos']
    } else {
      phaseNames = ['Fase única']
    }
    return phaseNames.map(n => ({ name: n, match_config: { ...DEFAULT_MATCH_CONFIG } }))
  }

  const [phases, setPhases] = useState<PhaseConfig[]>(() => {
    const savedPhases = vd.phases as Array<{ name: string; match_config: MatchConfig }> | undefined
    if (Array.isArray(savedPhases) && savedPhases.length > 0) {
      return savedPhases.map(p => ({ name: p.name, match_config: { ...DEFAULT_MATCH_CONFIG, ...p.match_config } }))
    }
    return buildPhasesForFormat(t.format as string ?? 'groups_elimination', {
      bracket_size: String(vd.bracket_size ?? '16'),
      seeding_method: (vd.seeding_method as string) ?? 'RANDOM',
      has_third_place_match: Boolean(vd.has_third_place_match ?? false),
      num_groups: String(vd.num_groups ?? '3'),
      teams_per_group: String(vd.teams_per_group ?? '4'),
      teams_advance_per_group: String(vd.teams_advance_per_group ?? '2'),
      group_scoring: (vd.scoring_system as string) ?? 'WIN_LOSS',
      tiebreak_criteria: (vd.tiebreak_criteria as string[]) ?? DEFAULT_TIEBREAK_CRITERIA,
      time_limit_minutes: String(vd.time_limit_minutes ?? ''),
      bracket_seeding: (vd.bracket_seeding as string) ?? 'CRUZADO',
    })
  })
  const [activePhaseIdx, setPhaseIdx] = useState(0)

  function applyFormatChange(newFormat: string, newFormatState?: FormatState) {
    const fs = newFormatState ?? formatState
    setFormat(newFormat)
    if (newFormatState) setFormatState(newFormatState)
    setPhases(buildPhasesForFormat(newFormat, fs))
    setPhaseIdx(0)
  }

  // ── Save ──────────────────────────────────────────────────────
  function handleSave() {
    if (!name.trim() || name.trim() === 'Nuevo torneo') {
      setError('Debes asignar un nombre al torneo antes de guardar')
      return
    }
    startTransition(async () => {
      setError('')
      const result = await updateTournament(t.id as string, {
        name, description: description || undefined,
        max_players: parseInt(maxPlayers),
        price_info: priceInfo || undefined,
        registration_type: regType as 'pair' | 'individual',
        format: format as 'elimination' | 'round_robin' | 'groups_elimination' | 'american',
        venue_name: venueName || undefined,
        venue_address: venueAddr || undefined,
        venue_details: {
          // Instalación
          court_count: parseInt(courtCount) || null,
          court_type: courtType, surface, services: serviceList,
          // Categorías
          categories,
          // Formato
          bracket_size:            parseInt(formatState.bracket_size) || null,
          seeding_method:          formatState.seeding_method,
          has_third_place_match:   formatState.has_third_place_match,
          num_groups:              parseInt(formatState.num_groups) || null,
          teams_per_group:         parseInt(formatState.teams_per_group) || null,
          teams_advance_per_group: parseInt(formatState.teams_advance_per_group) || null,
          scoring_system:          formatState.group_scoring,
          tiebreak_criteria:       formatState.tiebreak_criteria,
          time_limit_minutes:      formatState.time_limit_minutes ? parseInt(formatState.time_limit_minutes) : null,
          bracket_seeding:         formatState.bracket_seeding,
          // Fases snapshot
          phases: phases.map(p => ({ name: p.name, match_config: p.match_config })),
          // Horario
          courts: namedCourts,
          schedule: {
            start_time:  schedStart,
            end_time:    schedEnd,
            lunch_break: lunchEnabled
              ? { time: lunchTime, duration_minutes: parseInt(lunchDuration) || 60 }
              : null,
            phase_durations: Object.fromEntries(
              phases.map(ph => [ph.name, parseInt(phaseDurations[ph.name] ?? '90') || 90])
            ),
            time_blocks:       timeBlocks,
            court_assignments: courtAssignEnabled ? courtAssignments : null,
          },
        },
        start_date:     startDate ? new Date(startDate).toISOString() : undefined,
        end_date:       endDate   ? new Date(endDate).toISOString()   : undefined,
        cancel_deadline: cancelDl ? new Date(cancelDl).toISOString()  : undefined,
      })
      if ('error' in result) { setError(result.error as string); return }

      await saveTournamentPhases(t.id as string, phases.map(p => ({
        name: p.name, format,
        score_config: {
          sets_format:           p.match_config.sets_format,
          games_to_win_set:      p.match_config.games_to_win_set,
          deuce_mode:            p.match_config.deuce_mode,
          deciding_set_format:   p.match_config.deciding_set_format,
          tiebreak_points:       p.match_config.tiebreak_points,
          super_tiebreak_points: p.match_config.super_tiebreak_points,
          time_limit_minutes:    p.match_config.time_limit_minutes ? parseInt(p.match_config.time_limit_minutes) : null,
        },
      })))

      router.refresh()
    })
  }

  const TABS = [
    { id: 'datos',       label: 'Datos básicos' },
    { id: 'instalacion', label: 'Instalación' },
    { id: 'categorias',  label: 'Categorías' },
    { id: 'horario',     label: 'Horario' },
    { id: 'puntuacion',  label: 'Puntuación' },
  ]

  return (
    <div className="flex flex-col gap-5">

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
            className={cn('flex-1 py-[9px] px-2 rounded-[7px] text-[11px] font-medium transition-all',
              tab === tb.id ? 'bg-accent text-white font-bold' : 'text-muted-foreground hover:text-foreground'
            )}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Datos básicos ────────────────────────────────── */}
      {tab === 'datos' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">
          <FieldRow label="Nombre del torneo" req>
            <SI value={name} onChange={setName} className={name === 'Nuevo torneo' ? 'border-[var(--amber)] focus:ring-[var(--amber)]' : ''} />
            {name === 'Nuevo torneo' && (
              <p className="text-[11px] text-[var(--amber)] mt-1.5">Cambia el nombre antes de guardar</p>
            )}
          </FieldRow>
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
          <div>
            <p className="text-[12px] font-semibold text-foreground mb-2.5">Servicios disponibles</p>
            <div className="grid grid-cols-3 gap-2">
              {serviceList.map((svc, i) => (
                <label key={svc.key} onClick={() => setServices(sl => sl.map((s, j) => j === i ? { ...s, active: !s.active } : s))}
                  className={cn('flex items-center gap-2 px-3 py-[9px] rounded-[7px] border cursor-pointer text-[12px] transition-colors select-none',
                    svc.active ? 'border-accent bg-[var(--accent-surface)] text-accent font-semibold' : 'border-border bg-white text-muted-foreground')}>
                  <span className={cn('w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] shrink-0',
                    svc.active ? 'bg-accent border-accent text-white' : 'bg-white border-border')}>
                    {svc.active ? '✓' : ''}
                  </span>
                  {svc.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input value={newSvcName} onChange={e => setNewSvc(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newSvcName.trim()) {
                    setServices(sl => [...sl, { key: newSvcName.toLowerCase().replace(/\s+/g, '_'), label: newSvcName.trim(), active: true }])
                    setNewSvc('')
                  }
                }}
                placeholder="Añadir otro servicio..."
                className="flex-1 px-3 py-[7px] border border-border rounded-[7px] text-[12px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button onClick={() => {
                if (!newSvcName.trim()) return
                setServices(sl => [...sl, { key: newSvcName.toLowerCase().replace(/\s+/g, '_'), label: newSvcName.trim(), active: true }])
                setNewSvc('')
              }} className="px-3 py-[7px] bg-white border border-border rounded-[7px] text-[12px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors">
                + Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Categorías y formato ─────────────────────────── */}
      {tab === 'categorias' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">
          <div className="mb-5">
            <p className="text-[12px] font-semibold text-foreground mb-0.5">
              Categorías <span className="text-[var(--error)]">*</span>
            </p>
            <p className="text-[11px] text-muted-foreground mb-3">Cada categoría tendrá su propio cuadro de grupos y eliminatoria</p>
            <div className="flex flex-col gap-2">
              {categories.map((cat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={cat.name}
                    onChange={e => setCategories(cs => cs.map((c, j) => j === i ? { ...c, name: e.target.value } : c))}
                    placeholder="Nombre de la categoría"
                    className="flex-1 px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input value={cat.minScore}
                      onChange={e => setCategories(cs => cs.map((c, j) => j === i ? { ...c, minScore: e.target.value } : c))}
                      placeholder="3.5"
                      className="w-14 px-2 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground text-center focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <span className="text-[12px] text-muted-foreground">—</span>
                    <input value={cat.maxScore}
                      onChange={e => setCategories(cs => cs.map((c, j) => j === i ? { ...c, maxScore: e.target.value } : c))}
                      placeholder="4.25"
                      className="w-14 px-2 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground text-center focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  <button onClick={() => setCategories(cs => cs.filter((_, j) => j !== i))}
                    className="w-7 h-7 bg-[var(--error)] text-white rounded-[5px] text-xs font-bold flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={() => setCategories(cs => [...cs, { name: `${cs.length + 1}ª categoría`, minScore: '', maxScore: '' }])}
                className="self-start px-3 py-[5px] border border-border rounded-[7px] bg-white text-[12px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors">
                + Añadir categoría
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Intervalo de puntuación opcional (ej. 3.5 — 4.25)</p>
          </div>

          <Divider />

          <div className="mt-5">
            <FieldRow label="Formato del torneo" req>
              <SS value={format} onChange={v => applyFormatChange(v)}>
                <option value="elimination">Eliminación directa</option>
                <option value="groups_elimination">Fase de grupos + Eliminatoria</option>
                <option value="american">Americano (todos contra todos)</option>
              </SS>
            </FieldRow>

            <FormatConfigPanel format={format} state={formatState} onChange={newState => applyFormatChange(format, newState)} />
          </div>
        </div>
      )}

      {/* ── Tab: Horario ──────────────────────────────────────── */}
      {tab === 'horario' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px] flex flex-col gap-6">

          {/* Pistas */}
          <div>
            <SectionLabel>Pistas disponibles para este torneo</SectionLabel>
            <div className="flex flex-wrap gap-2 mb-3">
              {namedCourts.map((court, i) => (
                <div key={i} className="flex items-center gap-1.5 border border-border rounded-[7px] px-3 py-[7px] bg-white">
                  <input
                    value={court.name}
                    onChange={e => setNamedCourts(cs => cs.map((c, j) => j === i ? { name: e.target.value } : c))}
                    className="text-[12px] font-medium text-foreground bg-transparent border-none outline-none w-[72px]"
                  />
                  <button onClick={() => setNamedCourts(cs => cs.filter((_, j) => j !== i))}
                    className="text-light hover:text-[var(--error)] transition-colors text-[10px] leading-none">✕</button>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  value={newCourtName}
                  onChange={e => setNewCourtName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newCourtName.trim()) {
                      setNamedCourts(cs => [...cs, { name: newCourtName.trim() }])
                      setNewCourtName('')
                    }
                  }}
                  placeholder="+ Añadir pista"
                  className="px-3 py-[7px] border border-dashed border-accent/60 text-accent rounded-[7px] text-[12px] w-32 focus:outline-none focus:border-accent bg-[var(--accent-surface)] placeholder:text-accent/60"
                />
              </div>
            </div>
          </div>

          <Divider />

          {/* Horario general */}
          <div>
            <SectionLabel>Horario general</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Hora de inicio">
                <SI type="time" value={schedStart} onChange={setSchedStart} />
              </FieldRow>
              <FieldRow label="Hora de fin">
                <SI type="time" value={schedEnd} onChange={setSchedEnd} />
              </FieldRow>
            </div>
          </div>

          <Divider />

          {/* Descanso comida */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Descanso de comida</SectionLabel>
              <Toggle on={lunchEnabled} onToggle={() => setLunchEnabled(v => !v)} />
            </div>
            {lunchEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Hora de inicio">
                  <SI type="time" value={lunchTime} onChange={setLunchTime} />
                </FieldRow>
                <FieldRow label="Duración (minutos)">
                  <SI type="number" value={lunchDuration} onChange={setLunchDuration} placeholder="60" min="15" />
                </FieldRow>
              </div>
            )}
          </div>

          <Divider />

          {/* Duración por fase */}
          <div>
            <SectionLabel>Duración estimada por fase</SectionLabel>
            <div className="flex flex-col gap-2">
              {phases.map(ph => (
                <div key={ph.name} className="flex items-center gap-3">
                  <span className="text-[12px] font-medium text-foreground flex-1 min-w-0 truncate">{ph.name}</span>
                  <SI
                    type="number"
                    value={phaseDurations[ph.name] ?? '90'}
                    onChange={v => setPhaseDurations(d => ({ ...d, [ph.name]: v }))}
                    placeholder="90"
                    className="w-24"
                    min="10"
                  />
                  <span className="text-[12px] text-light shrink-0">min</span>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          {/* Franjas bloqueadas */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Franjas bloqueadas</SectionLabel>
              <button
                onClick={() => setTimeBlocks(b => [...b, {
                  id: Date.now().toString(),
                  courtName: namedCourts[0]?.name ?? '',
                  from: '09:00', to: '10:00', reason: '',
                }])}
                className="px-3 py-[5px] bg-white border border-border rounded-[7px] text-[12px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors"
              >
                + Añadir bloque
              </button>
            </div>
            {timeBlocks.length === 0 && (
              <p className="text-[12px] text-light">Sin franjas bloqueadas</p>
            )}
            <div className="flex flex-col gap-2">
              {timeBlocks.map(block => (
                <div key={block.id} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={block.courtName}
                    onChange={e => setTimeBlocks(b => b.map(bl => bl.id === block.id ? { ...bl, courtName: e.target.value } : bl))}
                    className="px-2 py-[7px] border border-border rounded-[7px] text-[12px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {namedCourts.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    {namedCourts.length === 0 && <option value="">Sin pistas</option>}
                  </select>
                  <SI type="time" value={block.from} onChange={v => setTimeBlocks(b => b.map(bl => bl.id === block.id ? { ...bl, from: v } : bl))} className="w-28" />
                  <span className="text-[12px] text-muted-foreground">—</span>
                  <SI type="time" value={block.to} onChange={v => setTimeBlocks(b => b.map(bl => bl.id === block.id ? { ...bl, to: v } : bl))} className="w-28" />
                  <input
                    value={block.reason}
                    onChange={e => setTimeBlocks(b => b.map(bl => bl.id === block.id ? { ...bl, reason: e.target.value } : bl))}
                    placeholder="Motivo (opcional)"
                    className="flex-1 min-w-0 px-3 py-[7px] border border-border rounded-[7px] text-[12px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button
                    onClick={() => setTimeBlocks(b => b.filter(bl => bl.id !== block.id))}
                    className="w-7 h-7 bg-[var(--error)] text-white rounded-[5px] text-xs font-bold flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          {/* Asignación pistas por categoría */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <SectionLabel>Pistas por categoría</SectionLabel>
                {!courtAssignEnabled && <p className="text-[11px] text-light -mt-2">Todas las pistas disponibles para todas las categorías</p>}
              </div>
              <Toggle on={courtAssignEnabled} onToggle={() => setCourtAssignEnabled(v => !v)} />
            </div>
            {courtAssignEnabled && (
              <>
                {namedCourts.length === 0 && (
                  <p className="text-[12px] text-light">Añade pistas arriba para asignarlas.</p>
                )}
                {categories.length === 0 && namedCourts.length > 0 && (
                  <p className="text-[12px] text-light">Añade categorías en la tab "Categorías" para asignarlas.</p>
                )}
                {namedCourts.length > 0 && categories.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="text-[12px] w-full">
                      <thead>
                        <tr>
                          <th className="text-left font-semibold text-foreground pb-2 pr-6 min-w-[120px]">Categoría</th>
                          {namedCourts.map(c => (
                            <th key={c.name} className="text-center font-semibold text-foreground pb-2 px-3 whitespace-nowrap">{c.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map(cat => (
                          <tr key={cat.name} className="border-t border-border">
                            <td className="py-2 pr-6 font-medium text-foreground">{cat.name || '—'}</td>
                            {namedCourts.map(c => {
                              const assigned = (courtAssignments[cat.name] ?? []).includes(c.name)
                              return (
                                <td key={c.name} className="text-center py-2 px-3">
                                  <button
                                    onClick={() => setCourtAssignments(a => {
                                      const cur = a[cat.name] ?? []
                                      const next = cur.includes(c.name) ? cur.filter(n => n !== c.name) : [...cur, c.name]
                                      return { ...a, [cat.name]: next }
                                    })}
                                    className={cn(
                                      'w-5 h-5 rounded border flex items-center justify-center mx-auto text-[10px] transition-colors',
                                      assigned ? 'bg-accent border-accent text-white' : 'bg-white border-border text-transparent'
                                    )}
                                  >✓</button>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Puntuación ───────────────────────────────────── */}
      {tab === 'puntuacion' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">
          <p className="text-[11px] text-muted-foreground mb-4">La configuración de puntuación se aplica por igual a todas las categorías.</p>
          <div className="flex gap-2 mb-5 flex-wrap">
            {phases.map((ph, i) => (
              <button key={i} onClick={() => setPhaseIdx(i)}
                className={cn('px-[14px] py-[7px] rounded-[7px] border text-[12px] cursor-pointer transition-colors',
                  activePhaseIdx === i
                    ? 'border-accent bg-[var(--accent-surface)] text-accent font-semibold'
                    : 'border-border bg-white text-muted-foreground font-medium hover:border-accent/40'
                )}>
                {ph.name}
              </button>
            ))}
          </div>
          {phases[activePhaseIdx] && (
            <MatchConfigPanel
              key={activePhaseIdx}
              config={phases[activePhaseIdx].match_config}
              onChange={cfg => setPhases(ps => ps.map((p, i) => i === activePhaseIdx ? { ...p, match_config: cfg } : p))}
            />
          )}
        </div>
      )}
    </div>
  )
}

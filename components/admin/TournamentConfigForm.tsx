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

const DEFAULT_TIEBREAK_CRITERIA = ['HEAD_TO_HEAD', 'SET_DIFFERENCE', 'GAME_DIFFERENCE', 'RANDOM']

const DEFAULT_MATCH_CONFIG: MatchConfig = {
  sets_format: 'BEST_OF_3',
  games_to_win_set: 6,
  deuce_mode: 'STAR_POINT',
  deciding_set_format: 'SUPER_TIEBREAK_10',
  tiebreak_points: 7,
  super_tiebreak_points: 10,
  time_limit_minutes: '',
}

// Phase name lists by bracket size
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
  const totalKnockout = numGroups * teamsAdvance
  const phases = ['Fase de grupos']
  if (totalKnockout >= 16) phases.push('Octavos de final')
  if (totalKnockout >= 8)  phases.push('Cuartos de final')
  if (totalKnockout >= 4)  phases.push('Semifinal')
  phases.push('Final')
  return phases
}

// ── Presets ───────────────────────────────────────────────────────────────────

interface PresetConfig {
  format: string
  bracket_size: string
  seeding_method: string
  has_third_place_match: boolean
  num_groups: string
  teams_per_group: string
  teams_advance_per_group: string
  group_scoring: string
  tiebreak_criteria: string[]
  time_limit_minutes: string
  match_config: MatchConfig
}

const PRESETS: { label: string; config: PresetConfig }[] = [
  {
    label: 'Torneo FIP',
    config: {
      format: 'elimination',
      bracket_size: '16',
      seeding_method: 'RANKING',
      has_third_place_match: false,
      num_groups: '4',
      teams_per_group: '4',
      teams_advance_per_group: '2',
      group_scoring: 'WIN_LOSS',
      tiebreak_criteria: DEFAULT_TIEBREAK_CRITERIA,
      time_limit_minutes: '',
      match_config: {
        sets_format: 'BEST_OF_3',
        games_to_win_set: 6,
        deuce_mode: 'STAR_POINT',
        deciding_set_format: 'SUPER_TIEBREAK_10',
        tiebreak_points: 7,
        super_tiebreak_points: 10,
        time_limit_minutes: '',
      },
    },
  },
  {
    label: 'Liga de club',
    config: {
      format: 'groups_elimination',
      bracket_size: '16',
      seeding_method: 'RANDOM',
      has_third_place_match: false,
      num_groups: '4',
      teams_per_group: '4',
      teams_advance_per_group: '2',
      group_scoring: 'WIN_LOSS',
      tiebreak_criteria: DEFAULT_TIEBREAK_CRITERIA,
      time_limit_minutes: '',
      match_config: {
        sets_format: 'BEST_OF_3',
        games_to_win_set: 6,
        deuce_mode: 'ADVANTAGE',
        deciding_set_format: 'SUPER_TIEBREAK_10',
        tiebreak_points: 7,
        super_tiebreak_points: 10,
        time_limit_minutes: '',
      },
    },
  },
  {
    label: 'Americano rápido',
    config: {
      format: 'american',
      bracket_size: '16',
      seeding_method: 'RANDOM',
      has_third_place_match: false,
      num_groups: '4',
      teams_per_group: '4',
      teams_advance_per_group: '2',
      group_scoring: 'WIN_LOSS',
      tiebreak_criteria: DEFAULT_TIEBREAK_CRITERIA,
      time_limit_minutes: '',
      match_config: {
        sets_format: 'BEST_OF_1',
        games_to_win_set: 4,
        deuce_mode: 'GOLDEN_POINT',
        deciding_set_format: 'SUPER_TIEBREAK_10',
        tiebreak_points: 7,
        super_tiebreak_points: 10,
        time_limit_minutes: '',
      },
    },
  },
  {
    label: 'JoyPadel',
    config: {
      format: 'groups_elimination',
      bracket_size: '16',
      seeding_method: 'RANDOM',
      has_third_place_match: false,
      num_groups: '4',
      teams_per_group: '4',
      teams_advance_per_group: '2',
      group_scoring: 'WIN_LOSS',
      tiebreak_criteria: DEFAULT_TIEBREAK_CRITERIA,
      time_limit_minutes: '',
      match_config: {
        sets_format: 'BEST_OF_1',
        games_to_win_set: 9,
        deuce_mode: 'STAR_POINT',
        deciding_set_format: 'SUPER_TIEBREAK_10',
        tiebreak_points: 7,
        super_tiebreak_points: 10,
        time_limit_minutes: '',
      },
    },
  },
  {
    label: 'Mexicano social',
    config: {
      format: 'american',
      bracket_size: '16',
      seeding_method: 'RANDOM',
      has_third_place_match: false,
      num_groups: '4',
      teams_per_group: '4',
      teams_advance_per_group: '2',
      group_scoring: 'WIN_LOSS',
      tiebreak_criteria: DEFAULT_TIEBREAK_CRITERIA,
      time_limit_minutes: '',
      match_config: {
        sets_format: 'BEST_OF_1',
        games_to_win_set: 6,
        deuce_mode: 'GOLDEN_POINT',
        deciding_set_format: 'SUPER_TIEBREAK_10',
        tiebreak_points: 7,
        super_tiebreak_points: 10,
        time_limit_minutes: '',
      },
    },
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

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

function SI({ value, onChange, type, placeholder, className, min, max }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string; min?: string; max?: string }) {
  return (
    <input
      type={type ?? 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.9px] text-light mb-3">{children}</p>
  )
}

// ── Tiebreak Criteria Reorderable List ───────────────────────────────────────

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
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="w-6 h-6 flex items-center justify-center rounded border border-border text-[11px] text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === criteria.length - 1}
              className="w-6 h-6 flex items-center justify-center rounded border border-border text-[11px] text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ↓
            </button>
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
        <SI
          type="number"
          value={String(config.games_to_win_set)}
          onChange={v => set('games_to_win_set', parseInt(v) || 6)}
          min="1"
          max="9"
          placeholder="6"
        />
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
          <SI
            type="number"
            value={String(config.tiebreak_points)}
            onChange={v => set('tiebreak_points', parseInt(v) || 7)}
            placeholder="7"
          />
        </FieldRow>
      )}

      {!isBestOf1 && config.deciding_set_format === 'SUPER_TIEBREAK_10' && (
        <FieldRow label="Puntos super tie-break">
          <SI
            type="number"
            value={String(config.super_tiebreak_points)}
            onChange={v => set('super_tiebreak_points', parseInt(v) || 10)}
            placeholder="10"
          />
        </FieldRow>
      )}

      <FieldRow label="Límite de tiempo (min)" note="Dejar vacío para sin límite">
        <SI
          type="number"
          value={config.time_limit_minutes}
          onChange={v => set('time_limit_minutes', v)}
          placeholder="Sin límite"
        />
      </FieldRow>

      <div className="bg-[var(--accent-surface)] text-accent rounded-[7px] px-4 py-3 text-[12px]">
        ⚠ Star Point es el estándar FIP desde enero 2026. Ventaja clásica y Golden Point son los más habituales en amateur.
      </div>
    </div>
  )
}

// ── Format Config ─────────────────────────────────────────────────────────────

interface FormatState {
  // elimination
  bracket_size: string
  seeding_method: string
  has_third_place_match: boolean
  // groups_elimination
  num_groups: string
  teams_per_group: string
  teams_advance_per_group: string
  group_scoring: string
  // shared (american + groups_elimination)
  tiebreak_criteria: string[]
  // american
  time_limit_minutes: string
}

function FormatConfigPanel({
  format,
  state,
  onChange,
}: {
  format: string
  state: FormatState
  onChange: (s: FormatState) => void
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
              {phases.map((ph, i) => (
                <span key={i} className="px-2.5 py-1 bg-white border border-border rounded-full text-[11px] text-foreground font-medium">{ph}</span>
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
    return (
      <div className="bg-[var(--muted)] border border-border rounded-[10px] p-[18px] mt-1 flex flex-col gap-4">
        <SectionLabel>Configuración de grupos + eliminatoria</SectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Número de grupos" req>
            <SS value={state.num_groups} onChange={v => set('num_groups', v)}>
              <option value="2">2 grupos</option>
              <option value="4">4 grupos</option>
              <option value="8">8 grupos</option>
            </SS>
          </FieldRow>
          <FieldRow label="Equipos por grupo" req>
            <SS value={state.teams_per_group} onChange={v => set('teams_per_group', v)}>
              <option value="3">3 equipos</option>
              <option value="4">4 equipos</option>
              <option value="5">5 equipos</option>
              <option value="6">6 equipos</option>
            </SS>
          </FieldRow>
          <FieldRow label="Equipos que pasan por grupo" req>
            <SS value={state.teams_advance_per_group} onChange={v => set('teams_advance_per_group', v)}>
              <option value="1">1 equipo</option>
              <option value="2">2 equipos</option>
              <option value="3">3 equipos</option>
            </SS>
          </FieldRow>
          <FieldRow label="Sistema de clasificación de grupo" req>
            <SS value={state.group_scoring} onChange={v => set('group_scoring', v)}>
              <option value="WIN_LOSS">Victoria/Derrota</option>
              <option value="GAMES_WON">Juegos ganados</option>
              <option value="SETS_WON">Sets ganados</option>
              <option value="POINTS_SCORED">Puntos</option>
            </SS>
          </FieldRow>
        </div>
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
          <SI
            type="number"
            value={state.time_limit_minutes}
            onChange={v => set('time_limit_minutes', v)}
            placeholder="Sin límite"
          />
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

  // Format-specific state
  const [formatState, setFormatState] = useState<FormatState>({
    bracket_size:            String(vd.bracket_size ?? '16'),
    seeding_method:          (vd.seeding_method as string) ?? 'RANDOM',
    has_third_place_match:   Boolean(vd.has_third_place_match ?? false),
    num_groups:              String(vd.num_groups ?? '4'),
    teams_per_group:         String(vd.teams_per_group ?? '4'),
    teams_advance_per_group: String(vd.teams_advance_per_group ?? '2'),
    group_scoring:           (vd.scoring_system as string) ?? 'WIN_LOSS',
    tiebreak_criteria:       (vd.tiebreak_criteria as string[]) ?? DEFAULT_TIEBREAK_CRITERIA,
    time_limit_minutes:      String(vd.time_limit_minutes ?? ''),
  })

  // ── Puntuación – per-phase configs ───────────────────────────
  function buildPhasesForFormat(fmt: string, fs: FormatState): PhaseConfig[] {
    let phaseNames: string[] = []
    if (fmt === 'elimination') {
      phaseNames = getEliminationPhaseNames(parseInt(fs.bracket_size) || 16)
      if (fs.has_third_place_match) phaseNames = [...phaseNames, '3er puesto']
    } else if (fmt === 'groups_elimination') {
      phaseNames = getGroupsEliminationPhaseNames(parseInt(fs.num_groups) || 4, parseInt(fs.teams_advance_per_group) || 2)
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
      return savedPhases.map(p => ({
        name: p.name,
        match_config: { ...DEFAULT_MATCH_CONFIG, ...p.match_config },
      }))
    }
    return buildPhasesForFormat(t.format as string ?? 'elimination', {
      bracket_size: String(vd.bracket_size ?? '16'),
      seeding_method: (vd.seeding_method as string) ?? 'RANDOM',
      has_third_place_match: Boolean(vd.has_third_place_match ?? false),
      num_groups: String(vd.num_groups ?? '4'),
      teams_per_group: String(vd.teams_per_group ?? '4'),
      teams_advance_per_group: String(vd.teams_advance_per_group ?? '2'),
      group_scoring: (vd.scoring_system as string) ?? 'WIN_LOSS',
      tiebreak_criteria: (vd.tiebreak_criteria as string[]) ?? DEFAULT_TIEBREAK_CRITERIA,
      time_limit_minutes: String(vd.time_limit_minutes ?? ''),
    })
  })
  const [activePhaseIdx, setPhaseIdx] = useState(0)

  function applyFormatChange(newFormat: string, newFormatState?: FormatState) {
    const fs = newFormatState ?? formatState
    setFormat(newFormat)
    if (newFormatState) setFormatState(newFormatState)
    const newPhases = buildPhasesForFormat(newFormat, fs)
    setPhases(newPhases)
    setPhaseIdx(0)
  }

  // ── Presets ───────────────────────────────────────────────────
  function applyPreset(preset: typeof PRESETS[number]) {
    const c = preset.config
    const newFs: FormatState = {
      bracket_size:            c.bracket_size,
      seeding_method:          c.seeding_method,
      has_third_place_match:   c.has_third_place_match,
      num_groups:              c.num_groups,
      teams_per_group:         c.teams_per_group,
      teams_advance_per_group: c.teams_advance_per_group,
      group_scoring:           c.group_scoring,
      tiebreak_criteria:       c.tiebreak_criteria,
      time_limit_minutes:      c.time_limit_minutes,
    }
    setFormatState(newFs)
    setFormat(c.format)
    const newPhases = buildPhasesForFormat(c.format, newFs)
    setPhases(newPhases.map(p => ({ ...p, match_config: { ...c.match_config } })))
    setPhaseIdx(0)
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
        format:            format as 'elimination' | 'round_robin' | 'groups_elimination' | 'american',
        venue_name:        venueName  || undefined,
        venue_address:     venueAddr  || undefined,
        venue_details: {
          court_count:             parseInt(courtCount) || null,
          court_type:              courtType,
          surface,
          services:                serviceList,
          categories,
          // Format config
          bracket_size:            parseInt(formatState.bracket_size) || null,
          seeding_method:          formatState.seeding_method,
          has_third_place_match:   formatState.has_third_place_match,
          num_groups:              parseInt(formatState.num_groups) || null,
          teams_per_group:         parseInt(formatState.teams_per_group) || null,
          teams_advance_per_group: parseInt(formatState.teams_advance_per_group) || null,
          scoring_system:          formatState.group_scoring,
          tiebreak_criteria:       formatState.tiebreak_criteria,
          time_limit_minutes:      formatState.time_limit_minutes ? parseInt(formatState.time_limit_minutes) : null,
          // Phases snapshot
          phases: phases.map(p => ({ name: p.name, match_config: p.match_config })),
        },
        start_date:     startDate  ? new Date(startDate).toISOString()  : undefined,
        end_date:       endDate    ? new Date(endDate).toISOString()    : undefined,
        cancel_deadline: cancelDl  ? new Date(cancelDl).toISOString()  : undefined,
      })
      if ('error' in result) { setError(result.error as string); return }

      await saveTournamentPhases(t.id as string, phases.map(p => ({
        name:         p.name,
        format:       format,
        score_config: {
          sets_format:          p.match_config.sets_format,
          games_to_win_set:     p.match_config.games_to_win_set,
          deuce_mode:           p.match_config.deuce_mode,
          deciding_set_format:  p.match_config.deciding_set_format,
          tiebreak_points:      p.match_config.tiebreak_points,
          super_tiebreak_points: p.match_config.super_tiebreak_points,
          time_limit_minutes:   p.match_config.time_limit_minutes ? parseInt(p.match_config.time_limit_minutes) : null,
        },
      })))

      router.refresh()
    })
  }

  const TABS = [
    { id: 'datos',       label: 'Datos básicos' },
    { id: 'instalacion', label: 'Instalación' },
    { id: 'categorias',  label: 'Categorías y formato' },
    { id: 'puntuacion',  label: 'Puntuación' },
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

      {/* Presets bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-light shrink-0">Partir de:</span>
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className="px-3 py-[5px] bg-white border border-border rounded-full text-[11px] font-semibold text-foreground hover:border-accent hover:text-accent transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

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
                  <input
                    value={cat.name}
                    onChange={e => setCategories(cs => cs.map((c, j) => j === i ? { ...c, name: e.target.value } : c))}
                    placeholder="Nombre de la categoría"
                    className="flex-1 px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
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
                  <button
                    onClick={() => setCategories(cs => cs.filter((_, j) => j !== i))}
                    className="w-7 h-7 bg-[var(--error)] text-white rounded-[5px] text-xs font-bold flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
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
            <SS value={format} onChange={v => applyFormatChange(v)}>
              <option value="elimination">Eliminación directa</option>
              <option value="groups_elimination">Fase de grupos + Eliminatoria</option>
              <option value="american">Americano (todos contra todos)</option>
            </SS>
          </FieldRow>

          <FormatConfigPanel
            format={format}
            state={formatState}
            onChange={newState => {
              applyFormatChange(format, newState)
            }}
          />
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
              onChange={cfg =>
                setPhases(ps => ps.map((p, i) => i === activePhaseIdx ? { ...p, match_config: cfg } : p))
              }
            />
          )}
        </div>
      )}
    </div>
  )
}

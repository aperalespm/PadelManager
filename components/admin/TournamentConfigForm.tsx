'use client'

import { useState, useTransition, useRef, useEffect, Children, isValidElement } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateTournament, saveTournamentPhases, deleteTournament, duplicateTournament, publishTournament, updateRegistrationConfig, setTournamentStatus } from '@/lib/actions/tournaments'
import { cn } from '@/lib/utils'

interface TournamentConfigFormProps {
  tournament: Record<string, unknown>
  otherTournaments: { id: string }[]
  hasExistingMatches?: boolean
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Service   = { key: string; label: string; active: boolean }
type Gender    = 'masculino' | 'femenino' | 'mixto'
type Category  = { name: string; minScore: string; maxScore: string; genders: Gender[] }
type Court     = { name: string; type: 'indoor' | 'outdoor' }
type TimeBlock = { id: string; courtName: string; from: string; to: string; reason: string }
type FieldType = 'text' | 'number' | 'select' | 'checkbox'

type FieldAppliesTo = 'all' | 'pair' | 'individual'

interface CustomField {
  id: string
  type: FieldType
  label: string
  required: boolean
  options: string[]
  applies_to: FieldAppliesTo
}

interface SystemFieldRequirements {
  name: boolean
  email: boolean
  phone: boolean
  level: boolean
  conditions: boolean
  partner_name: boolean
  partner_email: boolean
  partner_phone: boolean
  partner_level: boolean
}

interface RegistrationConfig {
  registration_types: string[]
  system_fields: SystemFieldRequirements
  custom_fields: CustomField[]
}

const DEFAULT_SYSTEM_FIELDS: SystemFieldRequirements = {
  name: true, email: true, phone: true, level: false, conditions: true,
  partner_name: true, partner_email: true, partner_phone: false, partner_level: false,
}

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
  min_matches_per_team: string
  turbo_mode: boolean
  group_points_win: string
  group_points_draw: string
  group_points_loss: string
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
  { name: 'Pista 1', type: 'indoor' },
  { name: 'Pista 2', type: 'indoor' },
  { name: 'Pista 3', type: 'indoor' },
  { name: 'Pista 4', type: 'indoor' },
]

const LOREM_CONDITIONS = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function expandCategories(cats: Category[]): { name: string; minScore: string; maxScore: string }[] {
  const result: { name: string; minScore: string; maxScore: string }[] = []
  for (const cat of cats) {
    if (!cat.name.trim()) continue
    if (!cat.genders || cat.genders.length === 0) {
      result.push({ name: cat.name, minScore: cat.minScore, maxScore: cat.maxScore })
    } else {
      for (const g of cat.genders) {
        const suffix = g === 'masculino' ? ' Masculino' : g === 'femenino' ? ' Femenino' : ' Mixto'
        result.push({ name: cat.name + suffix, minScore: cat.minScore, maxScore: cat.maxScore })
      }
    }
  }
  return result
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
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const options = Children.toArray(children)
    .filter((c): c is React.ReactElement<{ value: string; children: React.ReactNode }> =>
      isValidElement(c) && (c as React.ReactElement).type === 'option')
    .map(c => ({ value: c.props.value, label: c.props.children }))

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent">
        <span className="truncate text-left">{String(selected?.label ?? value)}</span>
        <span className={cn('text-[14px] text-muted-foreground ml-2 shrink-0 transition-transform duration-150', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-[7px] z-50 shadow-lg overflow-hidden">
          {options.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-[9px] text-[13px] transition-colors hover:bg-[var(--muted)]',
                opt.value === value ? 'text-accent font-semibold bg-[var(--accent-surface)]' : 'text-foreground'
              )}>
              {String(opt.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.9px] text-light mb-3">{children}</p>
}

function CopyLinkRow({ label, path, disabled }: { label: string; path: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(window.location.origin + path)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className={cn('flex items-center gap-3 px-3 py-2.5 border rounded-[7px]', disabled ? 'bg-[var(--muted)] border-border opacity-60' : 'bg-white border-border')}>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{label}</p>
        <p className="text-[12px] text-accent font-mono truncate">{path}</p>
      </div>
      <button type="button" onClick={copy} disabled={disabled}
        className={cn('shrink-0 px-3 py-1.5 rounded-[6px] text-[11px] font-semibold transition-colors',
          copied ? 'bg-[var(--success)] text-white' : 'bg-[var(--muted)] border border-border text-foreground hover:bg-white disabled:cursor-not-allowed')}>
        {copied ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  )
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

function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-7 h-7 flex items-center justify-center border border-border rounded-[5px] text-[15px] font-bold text-foreground hover:bg-[#f8fafc] disabled:opacity-30 transition-colors">−</button>
      <span className="w-8 text-center text-[14px] font-semibold text-foreground tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-7 h-7 flex items-center justify-center border border-border rounded-[5px] text-[15px] font-bold text-foreground hover:bg-[#f8fafc] disabled:opacity-30 transition-colors">+</button>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-border my-1" />
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[12px] border border-border p-6 max-w-sm w-full shadow-xl">
        <p className="text-[14px] font-semibold text-foreground mb-1">¿Eliminar elemento?</p>
        <p className="text-[13px] text-muted-foreground mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 border border-border rounded-[7px] text-[13px] font-medium text-foreground hover:bg-[var(--muted)] transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm}
            className="px-4 py-2 bg-[var(--error)] text-white rounded-[7px] text-[13px] font-semibold hover:opacity-90 transition-opacity">
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  )
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
          <FieldRow label="Mínimo de grupos por categoría" req note="El sistema puede crear más si hay más parejas">
            <SI type="number" value={state.num_groups} onChange={v => set('num_groups', v)} min="1" max="32" placeholder="3" />
          </FieldRow>
          <FieldRow label="Mínimo de parejas por grupo" req>
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
        {state.group_scoring === 'POINTS_SCORED' && (
          <div className="flex gap-6 px-1">
            {([
              { label: 'Victoria', key: 'group_points_win' },
              { label: 'Empate',   key: 'group_points_draw' },
              { label: 'Derrota',  key: 'group_points_loss' },
            ] as { label: string; key: keyof FormatState }[]).map(({ label, key }) => (
              <div key={String(key)} className="flex items-center gap-2">
                <span className="text-[12px] text-muted-foreground w-14">{label}</span>
                <Stepper value={parseInt(state[key] as string) || 0} onChange={v => set(key, String(v))} min={0} max={10} />
              </div>
            ))}
          </div>
        )}
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
        {state.group_scoring === 'POINTS_SCORED' && (
          <div className="flex gap-6 px-1">
            {([
              { label: 'Victoria', key: 'group_points_win' },
              { label: 'Empate',   key: 'group_points_draw' },
              { label: 'Derrota',  key: 'group_points_loss' },
            ] as { label: string; key: keyof FormatState }[]).map(({ label, key }) => (
              <div key={String(key)} className="flex items-center gap-2">
                <span className="text-[12px] text-muted-foreground w-14">{label}</span>
                <Stepper value={parseInt(state[key] as string) || 0} onChange={v => set(key, String(v))} min={0} max={10} />
              </div>
            ))}
          </div>
        )}
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

// ── Advanced Format Config ────────────────────────────────────────────────────

function AdvancedFormatConfig({ format, state, onChange }: {
  format: string; state: FormatState; onChange: (s: FormatState) => void
}) {
  return (
    <div className="mt-4 border border-border rounded-[10px] p-[18px] bg-[var(--muted)]">
      <SectionLabel>Configuración avanzada</SectionLabel>
      <div className="flex flex-col gap-4">

        {/* Min matches per team */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-foreground">Partidos mínimos por equipo</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Garantiza que cada equipo dispute al menos N partidos</p>
          </div>
          <Stepper
            value={parseInt(state.min_matches_per_team) || 1}
            onChange={v => onChange({ ...state, min_matches_per_team: String(v) })}
            min={1} max={10}
          />
        </div>

        <div className="h-px bg-border" />

        {/* Turbo mode */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-foreground">Modo Turbo</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Si un partido termina antes del tiempo reservado, el siguiente puede empezar en esa pista sin esperar</p>
          </div>
          <Toggle on={state.turbo_mode} onToggle={() => onChange({ ...state, turbo_mode: !state.turbo_mode })} />
        </div>

      </div>
    </div>
  )
}

// ── Competition Schema Preview ────────────────────────────────────────────────

const BSLOT  = 24
const BMATCH = BSLOT * 2
const BCOL   = 106
const BGAP   = 22

function schMatchTop(round: number, idx: number): number {
  const pad = BSLOT * (Math.pow(2, round) - 1)
  const gap = BMATCH * (Math.pow(2, round) - 1)
  return pad + idx * (BMATCH + gap)
}

function schMatchCenterY(round: number, idx: number): number {
  return schMatchTop(round, idx) + BSLOT
}

function BracketDiagram({ phases, matchCounts }: { phases: string[]; matchCounts: number[] }) {
  if (!phases.length) return null

  const totalH  = matchCounts[0] * BMATCH
  const CHAMP_W = 52
  const HDR_H   = 20

  type Seg = { x1: number; y1: number; x2: number; y2: number }
  const segs: Seg[] = []

  for (let r = 0; r < phases.length - 1; r++) {
    const cx   = r * (BCOL + BGAP)
    const nx   = (r + 1) * (BCOL + BGAP)
    const midX = cx + BCOL + BGAP / 2
    for (let m = 0; m < matchCounts[r]; m += 2) {
      const y1   = schMatchCenterY(r, m)
      const y2   = schMatchCenterY(r, m + 1)
      const yMid = (y1 + y2) / 2
      segs.push({ x1: cx + BCOL, y1, x2: midX, y2: y1 })
      segs.push({ x1: cx + BCOL, y1: y2, x2: midX, y2: y2 })
      segs.push({ x1: midX, y1, x2: midX, y2 })
      segs.push({ x1: midX, y1: yMid, x2: nx, y2: yMid })
    }
  }
  const lr    = phases.length - 1
  const lx    = lr * (BCOL + BGAP)
  const champY = schMatchCenterY(lr, 0)
  const champMidX = lx + BCOL + BGAP / 2
  segs.push({ x1: lx + BCOL, y1: champY, x2: champMidX, y2: champY })

  const totalW = phases.length * (BCOL + BGAP) + CHAMP_W

  return (
    <div className="relative shrink-0" style={{ width: totalW, height: totalH + HDR_H }}>
      {phases.map((name, r) => (
        <div key={r} className="absolute text-[9px] font-bold uppercase tracking-wide text-center text-muted-foreground overflow-hidden whitespace-nowrap"
          style={{ left: r * (BCOL + BGAP), top: 0, width: BCOL }}>{name}</div>
      ))}
      <div className="absolute text-[9px] font-bold uppercase tracking-wide text-center text-muted-foreground"
        style={{ left: lr * (BCOL + BGAP) + BCOL + BGAP / 2 - 8, top: 0, width: CHAMP_W }}>Campeón</div>

      <svg className="absolute pointer-events-none" style={{ left: 0, top: HDR_H }} width={totalW} height={totalH}>
        {segs.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#cbd5e1" strokeWidth={1.5} />
        ))}
      </svg>

      {phases.map((_, r) =>
        Array.from({ length: matchCounts[r] }, (__, m) => (
          <div key={`${r}-${m}`} className="absolute border border-border rounded-[5px] overflow-hidden bg-white"
            style={{ left: r * (BCOL + BGAP), top: HDR_H + schMatchTop(r, m), width: BCOL, height: BMATCH }}>
            <div className="px-2 text-[11px] flex items-center border-b border-border" style={{ height: BSLOT }}>
              {r === 0 ? <span className="text-muted-foreground/40">Pareja —</span> : <span className="text-foreground font-medium">Ganador</span>}
            </div>
            <div className="px-2 text-[11px] flex items-center" style={{ height: BSLOT }}>
              {r === 0 ? <span className="text-muted-foreground/40">Pareja —</span> : <span className="text-foreground font-medium">Ganador</span>}
            </div>
          </div>
        ))
      )}

      <div className="absolute flex items-center justify-center"
        style={{ left: champMidX, top: HDR_H + schMatchTop(lr, 0) + BSLOT / 2 - 14, width: 28, height: 28 }}>
        <span className="text-[22px] leading-none">🏆</span>
      </div>
    </div>
  )
}

function GroupCard({ num, teamCount, advanceCount }: { num: number; teamCount: number; advanceCount: number }) {
  return (
    <div className="border border-border rounded-[7px] overflow-hidden shrink-0 w-[90px]">
      <div className="bg-[#1e3a5f] text-white text-[9px] font-bold uppercase tracking-wide py-[5px] text-center">
        Grupo {num}
      </div>
      {Array.from({ length: teamCount }, (_, t) => (
        <div key={t}
          className={cn('px-1.5 flex items-center gap-1 border-t border-border/40 text-[10px]',
            t < advanceCount ? 'bg-[var(--accent-surface)] text-accent font-semibold' : 'bg-white text-muted-foreground/40'
          )}
          style={{ height: BSLOT }}>
          {t < advanceCount
            ? <span className="text-[var(--success)] font-bold text-[9px]">✓</span>
            : <span className="text-[9px]">○</span>}
          <span>{t + 1}ª</span>
        </div>
      ))}
    </div>
  )
}

function CompetitionSchemaPreview({
  categories, format, formatState, maxPlayers,
}: {
  categories: { name: string }[]
  format: string
  formatState: FormatState
  maxPlayers: string
}) {
  const activeCats = categories.filter(c => c.name.trim())
  const [selIdx, setSelIdx] = useState(0)
  if (!activeCats.length) return null

  const idx = Math.min(selIdx, activeCats.length - 1)

  return (
    <div className="mt-6 border border-border rounded-[10px] bg-white p-5">
      <SectionLabel>Esquema de la competición</SectionLabel>

      {activeCats.length > 1 && (
        <div className="mt-2 mb-4">
          <SS value={String(idx)} onChange={v => setSelIdx(Number(v))}>
            {activeCats.map((c, i) => (
              <option key={i} value={String(i)}>{c.name}</option>
            ))}
          </SS>
        </div>
      )}

      {(() => {
        const numGroups   = Math.max(1, parseInt(formatState.num_groups) || 1)
        const teamsPerGrp = Math.max(2, parseInt(formatState.teams_per_group) || 4)
        const teamsAdv    = Math.max(1, Math.min(parseInt(formatState.teams_advance_per_group) || 2, teamsPerGrp - 1))
        const bracketN    = parseInt(formatState.bracket_size) || parseInt(maxPlayers) || 16

        if (format === 'groups_elimination') {
          const classified = numGroups * teamsAdv
          const elimPhases = getGroupsEliminationPhaseNames(numGroups, teamsAdv).slice(1)
          const mc: number[] = []; let n = 1
          for (let i = elimPhases.length - 1; i >= 0; i--) { mc[i] = n; n *= 2 }
          const cols = Math.ceil(numGroups / 2)
          return (
            <div className="flex items-start gap-5 overflow-x-auto pb-2">
              <div className="shrink-0">
                <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Fase de grupos</p>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 90px)`, gap: '6px' }}>
                  {Array.from({ length: numGroups }, (_, g) => (
                    <GroupCard key={g} num={g + 1} teamCount={teamsPerGrp} advanceCount={teamsAdv} />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Top {teamsAdv} por grupo · {classified} clasificados
                </p>
              </div>
              <div className="flex items-center self-center shrink-0 text-muted-foreground text-lg">→</div>
              <div className="shrink-0">
                <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Eliminatoria</p>
                <BracketDiagram phases={elimPhases} matchCounts={mc} />
              </div>
            </div>
          )
        }

        if (format === 'elimination') {
          const phases = getEliminationPhaseNames(bracketN)
          const mc: number[] = []; let n = 1
          for (let i = phases.length - 1; i >= 0; i--) { mc[i] = n; n *= 2 }
          return (
            <div className="overflow-x-auto pb-2">
              <BracketDiagram phases={phases} matchCounts={mc} />
            </div>
          )
        }

        return (
          <div className="flex items-center gap-3">
            <div className="border border-border rounded-[7px] bg-[var(--muted)] px-4 py-2.5 text-[12px] font-medium text-foreground">
              Todos contra todos
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="bg-accent rounded-[7px] px-4 py-2.5 text-[12px] font-bold text-white">🏆 Clasificación final</div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Registration Tab Components ───────────────────────────────────────────────

function CustomFieldEditor({ field, isFirst, isLast, bothTypesEnabled, onUpdate, onRemove, onMove }: {
  field: CustomField
  isFirst: boolean
  isLast: boolean
  bothTypesEnabled: boolean
  onUpdate: (updates: Partial<CustomField>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [newOpt, setNewOpt] = useState('')
  const [pendingOptDel, setPendingOptDel] = useState<number | null>(null)

  return (
    <div className="border border-border rounded-[9px] p-3 bg-white flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-28 shrink-0">
          <SS value={field.type} onChange={v => onUpdate({ type: v as FieldType, options: [] })}>
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="select">Selección</option>
            <option value="checkbox">Checkbox</option>
          </SS>
        </div>
        <input value={field.label} onChange={e => onUpdate({ label: e.target.value })}
          placeholder="Etiqueta del campo"
          className="flex-1 min-w-0 px-2 py-[6px] border border-border rounded-[6px] text-[12px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent" />
        <label className="flex items-center gap-1 cursor-pointer shrink-0">
          <Toggle on={field.required} onToggle={() => onUpdate({ required: !field.required })} />
          <span className="text-[11px] text-muted-foreground">Oblig.</span>
        </label>
        {bothTypesEnabled && (
          <div className="flex shrink-0 rounded-[5px] overflow-hidden border border-border text-[10px] font-semibold">
            {([['all', 'Ambos'], ['pair', 'Pareja'], ['individual', 'Indiv.']] as [FieldAppliesTo, string][]).map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => onUpdate({ applies_to: v })}
                className={cn('px-2 py-[3px] transition-colors border-l border-border first:border-l-0',
                  field.applies_to === v ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground'
                )}>{lbl}</button>
            ))}
          </div>
        )}
        <div className="flex gap-0.5 shrink-0">
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst}
            className="w-6 h-6 flex items-center justify-center border border-border rounded text-[10px] text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-30 transition-colors">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast}
            className="w-6 h-6 flex items-center justify-center border border-border rounded text-[10px] text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-30 transition-colors">↓</button>
        </div>
        <button type="button" onClick={onRemove}
          className="w-6 h-6 flex items-center justify-center bg-[var(--error)] text-white rounded text-[10px] font-bold shrink-0 hover:opacity-80 transition-opacity">✕</button>
      </div>
      {field.type === 'select' && (
        <div className="ml-3 pl-3 border-l-2 border-border">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Opciones</p>
          <div className="flex flex-col gap-1 mb-1.5">
            {field.options.length === 0 && (
              <p className="text-[11px] text-light italic">Sin opciones todavía</p>
            )}
            {pendingOptDel !== null && (
              <ConfirmModal
                message={`Se eliminará la opción "${field.options[pendingOptDel]}".`}
                onConfirm={() => { onUpdate({ options: field.options.filter((_, j) => j !== pendingOptDel) }); setPendingOptDel(null) }}
                onCancel={() => setPendingOptDel(null)}
              />
            )}
            {field.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="flex-1 text-[11px] text-foreground bg-[var(--muted)] px-2 py-[4px] rounded">{opt}</span>
                <button type="button"
                  onClick={() => setPendingOptDel(i)}
                  className="text-[10px] text-[var(--error)] hover:opacity-80 font-bold leading-none">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={newOpt} onChange={e => setNewOpt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newOpt.trim()) {
                  onUpdate({ options: [...field.options, newOpt.trim()] })
                  setNewOpt('')
                }
              }}
              placeholder="Nueva opción…"
              className="flex-1 min-w-0 px-2 py-[5px] border border-border rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-accent" />
            <button type="button"
              onClick={() => { if (!newOpt.trim()) return; onUpdate({ options: [...field.options, newOpt.trim()] }); setNewOpt('') }}
              className="px-2 py-[5px] border border-border rounded text-[11px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors">+</button>
          </div>
        </div>
      )}
    </div>
  )
}

function RegistrationPreview({ config }: { config: RegistrationConfig }) {
  const hasPair       = config.registration_types.includes('pair')
  const hasIndividual = config.registration_types.includes('individual')
  const bothEnabled   = hasPair && hasIndividual
  const [previewMode, setPreviewMode] = useState<'pair' | 'individual'>(hasPair ? 'pair' : 'individual')

  const activePair = bothEnabled ? previewMode === 'pair' : hasPair
  const visibleFields = config.custom_fields.filter(f =>
    f.applies_to === 'all' ||
    (activePair && f.applies_to === 'pair') ||
    (!activePair && f.applies_to === 'individual')
  )

  return (
    <div className="bg-[var(--muted)] border border-border rounded-[10px] p-5 self-start sticky top-6">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-4">Vista previa del jugador</p>
      <div className="bg-white rounded-[10px] border border-border p-4 flex flex-col gap-3 max-h-[640px] overflow-y-auto w-[320px]">
        {/* Mode selector — only when both types enabled */}
        {bothEnabled && (
          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">¿Cómo te inscribes? <span className="text-[var(--error)]">*</span></label>
            <div className="flex rounded-[6px] overflow-hidden border border-border text-[12px] font-semibold">
              <button type="button" onClick={() => setPreviewMode('pair')}
                className={cn('flex-1 py-[6px] transition-colors', previewMode === 'pair' ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground')}>
                En pareja
              </button>
              <button type="button" onClick={() => setPreviewMode('individual')}
                className={cn('flex-1 py-[6px] transition-colors border-l border-border', previewMode === 'individual' ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground')}>
                Individual
              </button>
            </div>
          </div>
        )}
        {/* Jugador 1 */}
        <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground -mb-1">Jugador 1</p>
        {(
          [
            { key: 'name',  label: 'Nombre completo', kind: 'text' },
            { key: 'email', label: 'Email',            kind: 'text' },
            { key: 'phone', label: 'Teléfono',         kind: 'text' },
            { key: 'level', label: 'Nivel',            kind: 'number' },
          ] as const
        ).map(({ key, label, kind }) => (
          <div key={key}>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              {label}
              {config.system_fields[key]
                ? <span className="text-[var(--error)] ml-0.5">*</span>
                : <span className="text-muted-foreground font-normal ml-1">(opcional)</span>}
            </label>
            <div className={cn('h-8 border border-border rounded-[6px] bg-[var(--muted)]', kind === 'number' ? 'w-24' : 'w-full')} />
          </div>
        ))}
        {/* Jugador 2 — only in pair mode */}
        {activePair && (
          <div className="flex flex-col gap-3 pt-2 border-t border-border">
            <p className="text-[9px] font-bold uppercase tracking-wide text-accent -mb-1">Jugador 2</p>
            {(
              [
                { key: 'partner_name',  label: 'Nombre completo', kind: 'text' },
                { key: 'partner_email', label: 'Email',            kind: 'text' },
                { key: 'partner_phone', label: 'Teléfono',         kind: 'text' },
                { key: 'partner_level', label: 'Nivel',            kind: 'number' },
              ] as const
            ).map(({ key, label, kind }) => (
              <div key={key}>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  {label}
                  {config.system_fields[key]
                    ? <span className="text-[var(--error)] ml-0.5">*</span>
                    : <span className="text-muted-foreground font-normal ml-1">(opcional)</span>}
                </label>
                <div className={cn('h-8 border border-accent/30 rounded-[6px] bg-[var(--accent-surface)]', kind === 'number' ? 'w-24' : 'w-full')} />
              </div>
            ))}
          </div>
        )}

        {/* Custom fields — filtered by mode */}
        {visibleFields.map(field => (
          <div key={field.id}>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              {field.label || <span className="italic text-light">Campo sin nombre</span>}
              {field.required && <span className="text-[var(--error)] ml-0.5">*</span>}
            </label>
            {field.type === 'text' && <div className="w-full h-8 border border-border rounded-[6px] bg-[var(--muted)]" />}
            {field.type === 'number' && <div className="w-24 h-8 border border-border rounded-[6px] bg-[var(--muted)]" />}
            {field.type === 'select' && (
              <div className="w-full h-8 border border-border rounded-[6px] bg-[var(--muted)] flex items-center justify-between px-3">
                <span className="text-[11px] text-muted-foreground/60">{field.options[0] ?? 'Selecciona…'}</span>
                <span className="text-[10px] text-muted-foreground">▾</span>
              </div>
            )}
            {field.type === 'checkbox' && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-border rounded bg-white shrink-0" />
                <span className="text-[11px] text-foreground">{field.label || 'Campo sin nombre'}</span>
              </div>
            )}
          </div>
        ))}

        {/* Conditions */}
        <div className="pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">{LOREM_CONDITIONS}</p>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 border-2 border-border rounded bg-white shrink-0 mt-0.5" />
            <span className="text-[11px] font-medium text-foreground">
              Acepto los términos y condiciones
              {config.system_fields.conditions
                ? <span className="text-[var(--error)] ml-0.5">*</span>
                : <span className="text-muted-foreground font-normal ml-1">(opcional)</span>}
            </span>
          </div>
        </div>

        {/* Submit */}
        <button disabled className="w-full py-2.5 bg-accent rounded-[7px] text-[13px] font-semibold text-white opacity-80 mt-1 cursor-default">
          Inscribirse →
        </button>
      </div>
    </div>
  )
}

// ── Status chip constants ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', open: 'Abierto', active: 'En curso', finished: 'Finalizado',
}
const STATUS_CHIP: Record<string, string> = {
  draft:    'bg-muted text-muted-foreground border-border',
  open:     'bg-[var(--accent-surface)] text-accent border-accent/30',
  active:   'bg-[var(--warning-surface,#fff7ed)] text-[var(--warning)] border-[var(--warning)]/30',
  finished: 'bg-[var(--success-surface,#f0fdf4)] text-[var(--success)] border-[var(--success)]/30',
}
const ALL_STATUSES = ['draft', 'open', 'active', 'finished'] as const

// ── Main Component ────────────────────────────────────────────────────────────

export function TournamentConfigForm({ tournament: t, otherTournaments, hasExistingMatches }: TournamentConfigFormProps) {
  const router = useRouter()
  const [isDeleting, startDelete] = useTransition()
  const [isDuplicating, startDuplicate] = useTransition()
  const [isPublishing, startPublish] = useTransition()
  const [isChangingStatus, startStatusChange] = useTransition()
  const [tab, setTab] = useState('datos')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const [currentStatus, setCurrentStatus] = useState((t.status as string) ?? 'draft')
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Datos básicos ─────────────────────────────────────────────
  const [name, setName]        = useState(t.name as string ?? '')
  const [description, setDesc] = useState(t.description as string ?? '')
  const [maxPlayers, setMax]   = useState(String(t.max_players ?? 32))
  const [priceInfo, setPrice]  = useState(t.price_info as string ?? '')
  const [startDate, setStart]  = useState(t.start_date ? new Date(t.start_date as string).toISOString().split('T')[0] : '')
  const [endDate, setEnd]      = useState(t.end_date   ? new Date(t.end_date   as string).toISOString().split('T')[0] : '')
  const [cancelDl, setCancel]  = useState(t.cancel_deadline ? new Date(t.cancel_deadline as string).toISOString().split('T')[0] : '')

  // ── Instalación ───────────────────────────────────────────────
  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const [venueName, setVName]  = useState(t.venue_name    as string ?? '')
  const [venueAddr, setVAddr]  = useState(t.venue_address as string ?? '')
  const savedServices          = vd.services as Service[] | undefined
  const [serviceList, setServices] = useState<Service[]>(
    Array.isArray(savedServices) ? savedServices : DEFAULT_SERVICES.map(s => ({ ...s, active: false }))
  )
  const [newSvcName, setNewSvc] = useState('')

  // ── Confirm delete ────────────────────────────────────────────
  type PendingDelete =
    | { kind: 'category'; idx: number; label: string }
    | { kind: 'court'; idx: number; label: string }
    | { kind: 'timeblock'; id: string; label: string }
    | { kind: 'customfield'; fieldId: string; label: string }
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  function executePendingDelete() {
    if (!pendingDelete) return
    if (pendingDelete.kind === 'category')   setCategories(cs => cs.filter((_, j) => j !== pendingDelete.idx))
    if (pendingDelete.kind === 'court')      setNamedCourts(cs => cs.filter((_, j) => j !== pendingDelete.idx))
    if (pendingDelete.kind === 'timeblock')  setTimeBlocks(b => b.filter(bl => bl.id !== pendingDelete.id))
    if (pendingDelete.kind === 'customfield') removeCustomField(pendingDelete.fieldId)
    setPendingDelete(null)
  }

  // ── Categorías y formato ──────────────────────────────────────
  const savedCats = vd.categories as Array<Record<string, unknown>> | undefined
  const [categories, setCategories] = useState<Category[]>(
    Array.isArray(savedCats) && savedCats.length > 0 && typeof savedCats[0] === 'object'
      ? savedCats.map(c => ({
          name: (c.name as string) || '',
          minScore: (c.minScore as string) || '',
          maxScore: (c.maxScore as string) || '',
          genders: Array.isArray(c.genders) ? (c.genders as Gender[]) : [],
        }))
      : ['PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA'].map(n => ({ name: n, minScore: '', maxScore: '', genders: [] as Gender[] }))
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
    min_matches_per_team:    String(vd.min_matches_per_team ?? '1'),
    turbo_mode:              Boolean(vd.turbo_mode ?? false),
    group_points_win:        String(vd.group_points_win ?? '3'),
    group_points_draw:       String(vd.group_points_draw ?? '1'),
    group_points_loss:       String(vd.group_points_loss ?? '0'),
  })

  // ── Horario ───────────────────────────────────────────────────
  const savedCourts = vd.courts as Court[] | undefined
  const [namedCourts, setNamedCourts] = useState<Court[]>(
    Array.isArray(savedCourts) && savedCourts.length > 0
      ? savedCourts.map(c => ({ name: c.name, type: c.type ?? 'indoor' }))
      : DEFAULT_COURTS
  )

  const sched = (vd.schedule as Record<string, unknown>) ?? {}
  const savedLunch = sched.lunch_break as Record<string, unknown> | null | undefined

  const [schedStart, setSchedStart]       = useState((sched.start_time as string) ?? '10:00')
  const [schedEnd, setSchedEnd]           = useState((sched.end_time   as string) ?? '21:00')
  const [lunchEnabled, setLunchEnabled]   = useState(Boolean(savedLunch))
  const [lunchTime, setLunchTime]         = useState((savedLunch?.time as string) ?? '14:30')
  const [lunchDuration, setLunchDuration] = useState(String(savedLunch?.duration_minutes ?? '60'))
  const [transitionMinutes, setTransitionMinutes] = useState(String((sched.transition_minutes as number) ?? '10'))

  const savedPhaseDurs = sched.phase_durations as Record<string, number> | undefined
  const [phaseDurations, setPhaseDurations] = useState<Record<string, string>>(() => {
    if (savedPhaseDurs) {
      return Object.fromEntries(Object.entries(savedPhaseDurs).map(([k, v]) => [k, String(v)]))
    }
    // Fall back to time_limit_minutes stored in each phase (set by wizard)
    const savedPhases = vd.phases as Array<{ name: string; match_config?: { time_limit_minutes?: number } }> | undefined
    if (Array.isArray(savedPhases) && savedPhases.length > 0) {
      return Object.fromEntries(savedPhases.map(p => [p.name, String(p.match_config?.time_limit_minutes ?? 90)]))
    }
    return {}
  })

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
      min_matches_per_team:    String(vd.min_matches_per_team ?? '1'),
      turbo_mode:              Boolean(vd.turbo_mode ?? false),
      group_points_win:        String(vd.group_points_win ?? '3'),
      group_points_draw:       String(vd.group_points_draw ?? '1'),
      group_points_loss:       String(vd.group_points_loss ?? '0'),
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

  // ── Inscripción ───────────────────────────────────────────────
  const savedRegConfig = t.registration_config as RegistrationConfig | null | undefined
  const [registrationConfig, setRegistrationConfig] = useState<RegistrationConfig>(() => {
    const fallbackTypes = ['pair']
    if (savedRegConfig && typeof savedRegConfig === 'object' && Array.isArray(savedRegConfig.custom_fields)) {
      return {
        registration_types: Array.isArray(savedRegConfig.registration_types) ? savedRegConfig.registration_types : fallbackTypes,
        system_fields: { ...DEFAULT_SYSTEM_FIELDS, ...(savedRegConfig.system_fields ?? {}) },
        custom_fields: savedRegConfig.custom_fields.map(f => ({ ...f, applies_to: (f.applies_to ?? 'all') as FieldAppliesTo })),
      }
    }
    return { registration_types: fallbackTypes, system_fields: { ...DEFAULT_SYSTEM_FIELDS }, custom_fields: [] }
  })

  function toggleSystemField(key: keyof SystemFieldRequirements) {
    setRegistrationConfig(rc => ({
      ...rc,
      system_fields: { ...rc.system_fields, [key]: !rc.system_fields[key] },
    }))
  }

  function addCustomField() {
    const newField: CustomField = {
      id: Date.now().toString(),
      type: 'text',
      label: '',
      required: false,
      options: [],
      applies_to: 'all',
    }
    setRegistrationConfig(rc => ({ ...rc, custom_fields: [...rc.custom_fields, newField] }))
  }

  function updateCustomField(id: string, updates: Partial<CustomField>) {
    setRegistrationConfig(rc => ({
      ...rc,
      custom_fields: rc.custom_fields.map(f => f.id === id ? { ...f, ...updates } : f),
    }))
  }

  function removeCustomField(id: string) {
    setRegistrationConfig(rc => ({ ...rc, custom_fields: rc.custom_fields.filter(f => f.id !== id) }))
  }

  function moveCustomField(id: string, dir: -1 | 1) {
    setRegistrationConfig(rc => {
      const fields = [...rc.custom_fields]
      const idx = fields.findIndex(f => f.id === id)
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= fields.length) return rc
      ;[fields[idx], fields[newIdx]] = [fields[newIdx], fields[idx]]
      return { ...rc, custom_fields: fields }
    })
  }

  // ── Delete / Duplicate / Publish ─────────────────────────────
  function handleDelete() {
    startDelete(async () => {
      await deleteTournament(t.id as string)
      const next = otherTournaments[0]
      router.push(next ? `/admin/${next.id}` : '/admin')
    })
  }

  function handleDuplicate() {
    startDuplicate(async () => {
      const result = await duplicateTournament(t.id as string)
      if ('error' in result) return
      router.push(`/admin/${result.data!.id}/config`)
    })
  }

  function handlePublish() {
    if (!name.trim() || name.trim() === 'Nuevo torneo') {
      setError('Debes asignar un nombre al torneo antes de publicar')
      return
    }
    startPublish(async () => {
      setError('')
      await saveData()
      const result = await publishTournament(t.id as string)
      if ('error' in result) { setError(result.error as string); return }
      router.push(`/admin/${t.id as string}`)
    })
  }

  function handleStatusChange(newStatus: string) {
    setStatusDropdownOpen(false)
    if (newStatus === 'open' && (!name.trim() || name.trim() === 'Nuevo torneo')) {
      setError('Debes asignar un nombre al torneo antes de publicar')
      return
    }
    startStatusChange(async () => {
      setError('')
      await saveData()
      const result = await setTournamentStatus(t.id as string, newStatus as 'draft' | 'open' | 'active' | 'finished')
      if ('error' in result) { setError(result.error as string); return }
      setCurrentStatus(newStatus)
      router.refresh()
    })
  }

  useEffect(() => {
    if (!statusDropdownOpen) return
    function handler(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [statusDropdownOpen])

  // ── Autosave ──────────────────────────────────────────────────
  async function saveData() {
    if (!name.trim() || name.trim() === 'Nuevo torneo') return
    setIsSaving(true)
    const result = await updateTournament(t.id as string, {
      name, description: description || undefined,
      max_players: parseInt(maxPlayers),
      price_info: priceInfo || undefined,
      registration_type: (registrationConfig.registration_types.includes('pair') ? 'pair' : 'individual') as 'pair' | 'individual',
      format: format as 'elimination' | 'round_robin' | 'groups_elimination' | 'american',
      venue_name: venueName || undefined,
      venue_address: venueAddr || undefined,
      venue_details: {
        services: serviceList,
        categories,
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
        min_matches_per_team:    parseInt(formatState.min_matches_per_team) || 1,
        turbo_mode:              formatState.turbo_mode,
        group_points_win:        parseInt(formatState.group_points_win) || 3,
        group_points_draw:       parseInt(formatState.group_points_draw) || 1,
        group_points_loss:       parseInt(formatState.group_points_loss) || 0,
        phases: phases.map(p => ({ name: p.name, match_config: p.match_config })),
        courts: namedCourts,
        schedule: {
          start_time:  schedStart,
          end_time:    schedEnd,
          transition_minutes: (() => { const p = parseInt(transitionMinutes); return isNaN(p) ? 10 : p })(),
          lunch_break: lunchEnabled ? { time: lunchTime, duration_minutes: parseInt(lunchDuration) || 60 } : null,
          phase_durations: Object.fromEntries(phases.map(ph => [ph.name, parseInt(phaseDurations[ph.name] ?? '90') || 90])),
          time_blocks:       timeBlocks,
          court_assignments: courtAssignEnabled ? courtAssignments : null,
        },
      },
      start_date:      startDate ? new Date(startDate).toISOString() : undefined,
      end_date:        endDate   ? new Date(endDate).toISOString()   : undefined,
      cancel_deadline: cancelDl  ? new Date(cancelDl).toISOString()  : undefined,
    })
    if ('error' in result) { setError(result.error as string); setIsSaving(false); return }
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
    await updateRegistrationConfig(t.id as string, registrationConfig)
    setIsSaving(false)
    setSaveStatus('saved')
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
  }

  function scheduleSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(saveData, 1500)
  }

  // Auto-save whenever any field changes (skip initial render)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    scheduleSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    name, description, maxPlayers, priceInfo, startDate, endDate, cancelDl,
    venueName, venueAddr, serviceList,
    categories, format, formatState,
    namedCourts, schedStart, schedEnd, transitionMinutes,
    lunchEnabled, lunchTime, lunchDuration, phaseDurations,
    timeBlocks, courtAssignEnabled, courtAssignments,
    phases, registrationConfig,
  ])

  async function switchTab(newTab: string) {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    await saveData()
    setTab(newTab)
  }

  const TABS = [
    { id: 'datos',       label: 'Datos básicos' },
    { id: 'horario',     label: 'Pistas y horarios' },
    { id: 'categorias',  label: 'Categorías' },
    { id: 'puntuacion',  label: 'Fases' },
    { id: 'inscripcion', label: 'Inscripción' },
  ]

  const expandedCategories = expandCategories(categories)

  // ── Capacity = brackets × groups × teams/group ───────────────────────────
  // Courts/schedule are a scheduling constraint, not a registration cap.
  const numBrackets = expandedCategories.length || 1
  const _gs  = Math.max(2, parseInt(formatState.teams_per_group) || 4)
  const _tg  = Math.max(1, parseInt(formatState.num_groups) || 3)
  const capacityEstimate = _tg * _gs * numBrackets

  // ── Court feasibility (warn if schedule can't fit all group matches) ──────
  const courtWarning = (() => {
    const courts = namedCourts.length || 1
    const [sh, sm] = schedStart.split(':').map(Number)
    const [eh, em] = schedEnd.split(':').map(Number)
    let totalMin = (eh * 60 + em) - (sh * 60 + sm)
    if (isNaN(totalMin) || totalMin <= 0) return false
    if (lunchEnabled) totalMin -= (parseInt(lunchDuration) || 60)
    const transMin = (() => { const p = parseInt(transitionMinutes); return isNaN(p) ? 10 : p })()
    const groupPhase = phases.find(p => p.name.toLowerCase().includes('grupo'))
    const matchDur = parseInt(groupPhase?.match_config.time_limit_minutes ?? '')
                   || parseInt(formatState.time_limit_minutes)
                   || 60
    const availableSlots = courts * Math.floor(totalMin / (matchDur + transMin))
    const adv = Math.max(1, parseInt(formatState.teams_advance_per_group) || 2)
    const matchesPerGroup = _gs * (_gs - 1) / 2
    // Group phase matches + rough knockout estimate per bracket
    const neededSlots = numBrackets * (_tg * matchesPerGroup + (_tg * adv - 1))
    return neededSlots > availableSlots
  })()

  const pricePerPerson = parseFloat(priceInfo.replace(',', '.').replace(/[^0-9.]/g, '')) || 0
  const estimatedRevenue = capacityEstimate * pricePerPerson * 2

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground tracking-[-0.5px]">Configuración</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{t.name as string}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSaving && <span className="text-[12px] text-muted-foreground">Guardando...</span>}
          {!isSaving && saveStatus === 'saved' && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-[var(--success)] font-medium">✓ Guardado</span>
              <Link
                href={`/admin/${t.id as string}/horario?regenerate=1`}
                className="flex items-center gap-1 text-accent font-semibold hover:underline"
              >
                <span>↺</span>
                Actualizar horario
              </Link>
            </div>
          )}

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-2 px-3 py-[7px] bg-[var(--error-surface)] border border-[var(--error)]/30 rounded-[7px]">
              <span className="text-[12px] font-semibold text-[var(--error)]">¿Eliminar torneo?</span>
              <button onClick={handleDelete} disabled={isDeleting} className="px-2.5 py-1 bg-[var(--error)] text-white text-[12px] font-semibold rounded-[5px] hover:opacity-90 disabled:opacity-50 transition-opacity">
                {isDeleting ? '...' : 'Sí, eliminar'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 bg-white border border-border text-[12px] font-semibold rounded-[5px] hover:bg-[#f8fafc] transition-colors">
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} title="Eliminar torneo"
              className="w-[38px] h-[38px] flex items-center justify-center rounded-[7px] border border-[var(--error)]/40 text-[var(--error)] hover:bg-[var(--error-surface)] transition-colors">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M1.5 3.5h12M5 3.5V2h5v1.5M6 6.5v5M9 6.5v5M2.5 3.5l.8 9a1 1 0 001 .9h6.4a1 1 0 001-.9l.8-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {/* Duplicate */}
          {confirmDuplicate ? (
            <div className="flex items-center gap-2 px-3 py-[7px] bg-[#f8fafc] border border-border rounded-[7px]">
              <span className="text-[12px] font-semibold text-foreground">¿Duplicar torneo?</span>
              <button onClick={() => { setConfirmDuplicate(false); handleDuplicate() }} disabled={isDuplicating} className="px-2.5 py-1 bg-accent text-white text-[12px] font-semibold rounded-[5px] hover:opacity-90 disabled:opacity-50 transition-opacity">
                {isDuplicating ? '...' : 'Sí, duplicar'}
              </button>
              <button onClick={() => setConfirmDuplicate(false)} className="px-2.5 py-1 bg-white border border-border text-[12px] font-semibold rounded-[5px] hover:bg-[#f8fafc] transition-colors">
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDuplicate(true)} title="Duplicar torneo"
              className="w-[38px] h-[38px] flex items-center justify-center rounded-[7px] border border-border text-foreground hover:bg-[#f8fafc] transition-colors">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="5.5" y="5.5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M3 9.5V2h7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {/* Status chip dropdown */}
          <div className="relative" ref={statusDropdownRef}>
            <button
              onClick={() => setStatusDropdownOpen(o => !o)}
              disabled={isChangingStatus}
              className={cn(
                'flex items-center gap-2 px-[14px] py-[8px] rounded-[8px] border text-[13px] font-semibold transition-colors disabled:opacity-50',
                STATUS_CHIP[currentStatus] ?? STATUS_CHIP.draft
              )}
            >
              {currentStatus === 'active' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse shrink-0" />
              )}
              {isChangingStatus ? 'Cambiando...' : STATUS_LABELS[currentStatus] ?? currentStatus}
              <span className={cn('text-[13px] ml-0.5 shrink-0 transition-transform duration-150', statusDropdownOpen && 'rotate-180')}>▾</span>
            </button>

            {statusDropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 z-30 bg-white border border-border rounded-[10px] shadow-xl p-1.5 min-w-[180px]">
                {ALL_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => s !== currentStatus && handleStatusChange(s)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-[9px] rounded-[7px] text-[13px] font-semibold transition-colors',
                      s === currentStatus
                        ? cn(STATUS_CHIP[s], 'cursor-default')
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    {s === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0" />}
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-[13px] text-[var(--error)]">{error}</p>}

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-border rounded-[10px] p-[5px]">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => switchTab(tb.id)}
            className={cn('flex-1 py-[9px] px-2 rounded-[7px] text-[11px] font-medium transition-all',
              tab === tb.id ? 'bg-accent text-white font-bold' : 'text-muted-foreground hover:text-foreground'
            )}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Cuadro out-of-sync warning ───────────────────────────── */}
      {saveStatus === 'saved' && hasExistingMatches && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--warning-surface)] border border-[var(--warning)]/30 rounded-[10px]">
          <p className="text-[13px] text-[var(--warning)] font-medium">
            ⚠️ El cuadro actual puede no reflejar estos cambios de configuración.
          </p>
          <Link
            href={`/admin/${t.id as string}/cuadro`}
            className="shrink-0 text-[12px] font-semibold text-[var(--warning)] border border-[var(--warning)]/40 px-3 py-1.5 rounded-[7px] hover:bg-[var(--warning)]/10 transition-colors"
          >
            Ir al cuadro →
          </Link>
        </div>
      )}

      {/* ── Capacity & Revenue sticky bar ────────────────────────── */}
      <div className="sticky top-4 z-20 flex flex-col bg-white border border-border rounded-[10px] overflow-hidden shadow-sm">
        <div className="flex items-center">
          <div className="flex-1 px-5 py-3 border-r border-border">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">Capacidad estimada</p>
            <p className="text-[22px] font-extrabold leading-none tracking-[-0.5px] text-accent">
              {capacityEstimate} <span className="text-[13px] font-semibold text-muted-foreground">parejas</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{numBrackets} bracket{numBrackets !== 1 ? 's' : ''} · {_tg} grupos · {_gs} eq/grupo</p>
          </div>
          <div className="flex-1 px-5 py-3 border-r border-border">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">Precio por persona</p>
            <p className="text-[22px] font-extrabold leading-none tracking-[-0.5px] text-foreground">
              {pricePerPerson > 0 ? `${pricePerPerson}€` : <span className="text-[13px] font-normal text-muted-foreground italic">Sin precio</span>}
            </p>
          </div>
          <div className="flex-1 px-5 py-3 bg-[var(--success-surface)]">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--success)] mb-0.5">Facturación estimada</p>
            <p className="text-[22px] font-extrabold leading-none tracking-[-0.5px] text-[var(--success)]">
              {pricePerPerson > 0 ? `${estimatedRevenue.toLocaleString('es-ES')}€` : <span className="text-[13px] font-normal italic">—</span>}
            </p>
          </div>
        </div>
        {courtWarning && (
          <div className="border-t border-[var(--amber)]/30 bg-[var(--amber-surface)] px-5 py-2 flex items-center gap-2">
            <span className="text-[var(--amber)] text-[13px]">⚠</span>
            <p className="text-[12px] text-[var(--amber)] font-medium">
              Las pistas pueden quedar ajustadas para este aforo. Revisa el número de pistas y el horario en la pestaña anterior.
            </p>
          </div>
        )}
      </div>

      {/* ── Tab: Datos básicos + Localización ────────────────── */}
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
          <FieldRow label="Precio por persona" note="El precio se muestra por persona; la facturación se calcula por pareja (×2)"><SI value={priceInfo} onChange={setPrice} placeholder="15 €" /></FieldRow>
          <FieldRow label="Fecha límite de cancelación" note="Después de esta fecha solo el organizador puede cancelar">
            <SI type="date" value={cancelDl} onChange={setCancel} />
          </FieldRow>

          <Divider />

          <FieldRow label="Nombre de la instalación" req><SI value={venueName} onChange={setVName} placeholder="Padelton Leganés" /></FieldRow>
          <FieldRow label="Dirección" req><SI value={venueAddr} onChange={setVAddr} placeholder="Calle de las Pistas 12, Leganés" /></FieldRow>
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

      {/* ── Tab: Formato ─────────────────────────────────────── */}
      {tab === 'categorias' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px]">

          {/* Categorías */}
          <div className="mb-5">
            <p className="text-[12px] font-semibold text-foreground mb-0.5">
              Categorías <span className="text-[var(--error)]">*</span>
            </p>
            <p className="text-[11px] text-muted-foreground mb-3">
              Selecciona los géneros para dividir cada categoría automáticamente
              {expandedCategories.length > 0 && categories.length !== expandedCategories.length && (
                <span className="ml-1 text-accent font-medium">· {expandedCategories.length} categorías activas</span>
              )}
            </p>
            <div className="flex flex-col gap-2">
              {categories.map((cat, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <input value={cat.name}
                    onChange={e => setCategories(cs => cs.map((c, j) => j === i ? { ...c, name: e.target.value } : c))}
                    placeholder="Nombre"
                    className="w-[120px] px-3 py-[9px] border border-border rounded-[7px] text-[13px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
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
                  {/* Gender toggles */}
                  <div className="flex gap-1 shrink-0">
                    {(['masculino', 'femenino', 'mixto'] as const).map(g => {
                      const gLabel = g === 'masculino' ? 'M' : g === 'femenino' ? 'F' : 'X'
                      const gTitle = g === 'masculino' ? 'Masculino' : g === 'femenino' ? 'Femenino' : 'Mixto'
                      const active = cat.genders.includes(g)
                      return (
                        <button key={g} type="button" title={gTitle}
                          onClick={() => setCategories(cs => cs.map((c, j) => j === i ? {
                            ...c,
                            genders: active ? c.genders.filter(x => x !== g) : [...c.genders, g],
                          } : c))}
                          className={cn(
                            'w-7 h-7 rounded-[5px] border text-[11px] font-bold transition-colors',
                            active ? 'bg-accent border-accent text-white' : 'bg-white border-border text-muted-foreground hover:border-accent/40'
                          )}>
                          {gLabel}
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={() => setPendingDelete({ kind: 'category', idx: i, label: cat.name || `Categoría ${i + 1}` })}
                    className="w-7 h-7 bg-[var(--error)] text-white rounded-[5px] text-xs font-bold flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={() => setCategories(cs => {
                const maxN = cs.reduce((m, c) => { const n = c.name.match(/^(\d+)/); return n ? Math.max(m, parseInt(n[1])) : m }, 0)
                return [...cs, { name: `${maxN + 1}ª`, minScore: '', maxScore: '', genders: [] }]
              })}
                className="self-start px-3 py-[5px] border border-border rounded-[7px] bg-white text-[12px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors">
                + Añadir categoría
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              M = Masculino · F = Femenino · X = Mixto · Mín. partidos garantizados por fase de grupos · Parejas que pasan por grupo (target)
            </p>
          </div>

          <Divider />

          {/* Formato */}
          <div className="mt-5">
            <FieldRow label="Formato del torneo" req>
              <SS value={format} onChange={v => applyFormatChange(v)}>
                <option value="elimination">Eliminación directa</option>
                <option value="groups_elimination">Fase de grupos + Eliminatoria</option>
                <option value="american">Americano (todos contra todos)</option>
              </SS>
            </FieldRow>

            <FormatConfigPanel format={format} state={formatState} onChange={newState => applyFormatChange(format, newState)} />

            <AdvancedFormatConfig format={format} state={formatState} onChange={setFormatState} />
          </div>

          <CompetitionSchemaPreview
            categories={expandedCategories}
            format={format}
            formatState={formatState}
            maxPlayers={maxPlayers}
          />
        </div>
      )}

      {/* ── Tab: Horario ──────────────────────────────────────── */}
      {tab === 'horario' && (
        <div className="bg-white border border-border rounded-[10px] p-[26px] flex flex-col gap-6">

          {/* Pistas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Pistas del torneo</SectionLabel>
              <button
                type="button"
                onClick={() => setNamedCourts(cs => [...cs, { name: `Pista ${cs.length + 1}`, type: 'indoor' }])}
                className="px-3 py-[5px] bg-white border border-border rounded-[7px] text-[12px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors"
              >
                + Añadir pista
              </button>
            </div>
            {namedCourts.length === 0 ? (
              <p className="text-[12px] text-light">Sin pistas configuradas. Añade al menos una pista para programar partidos.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {namedCourts.map((court, i) => (
                  <div key={i} className="flex items-center gap-2 border border-border rounded-[8px] px-3 py-[9px] bg-white">
                    <span className="text-[11px] font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                    <input
                      value={court.name}
                      onChange={e => setNamedCourts(cs => cs.map((c, j) => j === i ? { ...c, name: e.target.value } : c))}
                      onBlur={() => scheduleSave()}
                      className="flex-1 text-[13px] font-medium text-foreground bg-transparent border-none outline-none min-w-0"
                    />
                    <div className="flex shrink-0 rounded-[5px] overflow-hidden border border-border text-[11px] font-semibold">
                      <button type="button"
                        onClick={() => { setNamedCourts(cs => cs.map((c, j) => j === i ? { ...c, type: 'indoor' } : c)); scheduleSave() }}
                        className={cn('px-2 py-[3px] transition-colors', court.type === 'indoor' ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground')}
                      >Indoor</button>
                      <button type="button"
                        onClick={() => { setNamedCourts(cs => cs.map((c, j) => j === i ? { ...c, type: 'outdoor' } : c)); scheduleSave() }}
                        className={cn('px-2 py-[3px] transition-colors border-l border-border', court.type === 'outdoor' ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground')}
                      >Outdoor</button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ kind: 'court', idx: i, label: court.name || `Pista ${i + 1}` })}
                      className="w-6 h-6 flex items-center justify-center bg-[var(--error)] text-white rounded text-[10px] font-bold shrink-0 hover:opacity-80 transition-opacity"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Divider />

          {/* Horario general */}
          <div>
            <SectionLabel>Horario general</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Hora de inicio"><SI type="time" value={schedStart} onChange={setSchedStart} /></FieldRow>
              <FieldRow label="Hora de fin"><SI type="time" value={schedEnd} onChange={setSchedEnd} /></FieldRow>
            </div>
            <FieldRow label="Tiempo entre partidos (transición)" note="Tiempo entre el fin de un partido y el inicio del siguiente en la misma pista">
              <div className="flex items-center gap-2">
                <SI type="number" value={transitionMinutes} onChange={setTransitionMinutes} className="w-24" min="0" max="60" placeholder="10" />
                <span className="text-[12px] text-muted-foreground">min</span>
              </div>
            </FieldRow>
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
                <FieldRow label="Hora de inicio"><SI type="time" value={lunchTime} onChange={setLunchTime} /></FieldRow>
                <FieldRow label="Duración (minutos)"><SI type="number" value={lunchDuration} onChange={setLunchDuration} placeholder="60" min="15" /></FieldRow>
              </div>
            )}
          </div>

          <Divider />

          {/* Franjas bloqueadas */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>Franjas bloqueadas</SectionLabel>
              <button
                onClick={() => setTimeBlocks(b => [...b, { id: Date.now().toString(), courtName: namedCourts[0]?.name ?? '', from: '09:00', to: '10:00', reason: '' }])}
                className="px-3 py-[5px] bg-white border border-border rounded-[7px] text-[12px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors">
                + Añadir bloque
              </button>
            </div>
            {timeBlocks.length === 0 && <p className="text-[12px] text-light">Sin franjas bloqueadas</p>}
            <div className="flex flex-col gap-2">
              {timeBlocks.map(block => (
                <div key={block.id} className="flex items-center gap-2 flex-wrap">
                  <div className="w-32 shrink-0">
                    <SS value={block.courtName} onChange={v => setTimeBlocks(b => b.map(bl => bl.id === block.id ? { ...bl, courtName: v } : bl))}>
                      {namedCourts.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      {namedCourts.length === 0 && <option value="">Sin pistas</option>}
                    </SS>
                  </div>
                  <SI type="time" value={block.from} onChange={v => setTimeBlocks(b => b.map(bl => bl.id === block.id ? { ...bl, from: v } : bl))} className="w-28" />
                  <span className="text-[12px] text-muted-foreground">—</span>
                  <SI type="time" value={block.to} onChange={v => setTimeBlocks(b => b.map(bl => bl.id === block.id ? { ...bl, to: v } : bl))} className="w-28" />
                  <input value={block.reason}
                    onChange={e => setTimeBlocks(b => b.map(bl => bl.id === block.id ? { ...bl, reason: e.target.value } : bl))}
                    placeholder="Motivo (opcional)"
                    className="flex-1 min-w-0 px-3 py-[7px] border border-border rounded-[7px] text-[12px] bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-accent" />
                  <button onClick={() => setPendingDelete({ kind: 'timeblock', id: block.id, label: `${block.courtName} ${block.from}–${block.to}` })}
                    className="w-7 h-7 bg-[var(--error)] text-white rounded-[5px] text-xs font-bold flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">✕</button>
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
                {namedCourts.length === 0 && <p className="text-[12px] text-light">Añade pistas arriba para asignarlas.</p>}
                {expandedCategories.length === 0 && namedCourts.length > 0 && <p className="text-[12px] text-light">Añade categorías en la tab Formato para asignarlas.</p>}
                {namedCourts.length > 0 && expandedCategories.length > 0 && (
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
                        {expandedCategories.map(cat => (
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
                                    className={cn('w-5 h-5 rounded border flex items-center justify-center mx-auto text-[10px] transition-colors',
                                      assigned ? 'bg-accent border-accent text-white' : 'bg-white border-border text-transparent'
                                    )}>✓</button>
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

      {/* ── Tab: Inscripción ──────────────────────────────────── */}
      {tab === 'inscripcion' && (
        <div className="grid grid-cols-[1fr_340px] gap-5 items-start">

          {/* Builder */}
          <div className="bg-white border border-border rounded-[10px] p-[26px]">

            {/* Capacidad calculada */}
            <div className="mb-5">
              <p className="text-[12px] font-semibold text-foreground mb-0.5">Límite de inscripciones</p>
              <p className="text-[11px] text-muted-foreground mb-3">
                El sistema puede gestionar <strong>{capacityEstimate} parejas</strong> según la configuración actual. Puedes reducir el límite si quieres.
              </p>
              <div className="flex items-center gap-3">
                <SI type="number" value={maxPlayers} onChange={setMax} className="w-28" min="2" placeholder={String(capacityEstimate)} />
                <span className="text-[12px] text-muted-foreground">parejas máximo (dejar vacío = usar capacidad calculada)</span>
              </div>
            </div>

            <Divider />

            {/* Tipo de inscripción */}
            <div className="mb-5">
              <FieldRow label="Tipo de inscripción" req>
                <SS
                  value={
                    registrationConfig.registration_types.includes('pair') && registrationConfig.registration_types.includes('individual')
                      ? 'both'
                      : registrationConfig.registration_types.includes('pair')
                      ? 'pair'
                      : 'individual'
                  }
                  onChange={v => setRegistrationConfig(rc => ({
                    ...rc,
                    registration_types: v === 'both' ? ['pair', 'individual'] : [v],
                  }))}
                >
                  <option value="pair">Por pareja — los jugadores se inscriben en pareja</option>
                  <option value="individual">Individual — el sistema empareja automáticamente</option>
                  <option value="both">Por pareja e individual — el jugador elige al inscribirse</option>
                </SS>
              </FieldRow>
            </div>

            <Divider />

            {/* Default fields */}
            <div className="mt-5 mb-5">
              <p className="text-[12px] font-semibold text-foreground mb-0.5">Campos por defecto</p>
              <p className="text-[11px] text-muted-foreground mb-2">El toggle indica si el campo es obligatorio u opcional para el jugador</p>
              <div className="flex flex-col gap-1.5">
                {/* Jugador 1 */}
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mt-1 mb-0.5 px-1">Jugador 1</p>
                {([
                  { key: 'name',   label: 'Nombre completo', type: 'texto' },
                  { key: 'email',  label: 'Email',           type: 'email' },
                  { key: 'phone',  label: 'Teléfono',        type: 'texto' },
                  { key: 'level',  label: 'Nivel',           type: 'número' },
                ] as { key: keyof SystemFieldRequirements; label: string; type: string }[]).map(f => (
                  <div key={f.key} className="flex items-center gap-2 px-3 py-[9px] bg-[var(--muted)] border border-border rounded-[7px]">
                    <span className="text-[11px] text-light">🔒</span>
                    <span className="flex-1 text-[12px] text-foreground font-medium">{f.label}</span>
                    <span className="text-[10px] text-muted-foreground bg-white border border-border px-2 py-0.5 rounded-full">{f.type}</span>
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                      <Toggle on={registrationConfig.system_fields[f.key]} onToggle={() => toggleSystemField(f.key)} />
                      <span className={cn('text-[11px] font-semibold w-16', registrationConfig.system_fields[f.key] ? 'text-[var(--error)]' : 'text-muted-foreground')}>
                        {registrationConfig.system_fields[f.key] ? 'Obligatorio' : 'Opcional'}
                      </span>
                    </label>
                  </div>
                ))}

                {/* Jugador 2 — only when pair mode active */}
                {registrationConfig.registration_types.includes('pair') && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-accent mt-2 mb-0.5 px-1">Jugador 2</p>
                    {([
                      { key: 'partner_name',  label: 'Nombre completo', type: 'texto' },
                      { key: 'partner_email', label: 'Email',            type: 'email' },
                      { key: 'partner_phone', label: 'Teléfono',         type: 'texto' },
                      { key: 'partner_level', label: 'Nivel',            type: 'número' },
                    ] as { key: keyof SystemFieldRequirements; label: string; type: string }[]).map(f => (
                      <div key={f.key} className="flex items-center gap-2 px-3 py-[9px] bg-[var(--accent-surface)] border border-accent/25 rounded-[7px]">
                        <span className="text-[11px] text-light">🔒</span>
                        <span className="flex-1 text-[12px] text-foreground font-medium">{f.label}</span>
                        <span className="text-[10px] text-accent bg-white border border-accent/25 px-2 py-0.5 rounded-full">{f.type}</span>
                        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                          <Toggle on={registrationConfig.system_fields[f.key]} onToggle={() => toggleSystemField(f.key)} />
                          <span className={cn('text-[11px] font-semibold w-16', registrationConfig.system_fields[f.key] ? 'text-[var(--error)]' : 'text-muted-foreground')}>
                            {registrationConfig.system_fields[f.key] ? 'Obligatorio' : 'Opcional'}
                          </span>
                        </label>
                      </div>
                    ))}
                  </>
                )}

                {/* Conditions — always last inside default fields */}
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mt-2 mb-0.5 px-1">Condiciones</p>
                <div className="flex items-center gap-2 px-3 py-[9px] bg-[var(--muted)] border border-border rounded-[7px]">
                  <span className="text-[11px] text-light">🔒</span>
                  <span className="flex-1 text-[12px] text-foreground font-medium">Acepto los términos y condiciones</span>
                  <span className="text-[10px] text-muted-foreground bg-white border border-border px-2 py-0.5 rounded-full">checkbox</span>
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <Toggle on={registrationConfig.system_fields.conditions} onToggle={() => toggleSystemField('conditions')} />
                    <span className={cn('text-[11px] font-semibold w-16', registrationConfig.system_fields.conditions ? 'text-[var(--error)]' : 'text-muted-foreground')}>
                      {registrationConfig.system_fields.conditions ? 'Obligatorio' : 'Opcional'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <Divider />

            {/* Custom fields */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[12px] font-semibold text-foreground">Campos personalizados</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Opcionales o requeridos · se añaden después de los campos del sistema</p>
                </div>
                <button onClick={addCustomField}
                  className="px-3 py-[5px] border border-border rounded-[7px] bg-white text-[12px] font-semibold text-foreground hover:bg-[#f8fafc] transition-colors shrink-0">
                  + Añadir campo
                </button>
              </div>

              {registrationConfig.custom_fields.length === 0 && (
                <p className="text-[12px] text-light py-2">Sin campos personalizados. Los jugadores solo verán los campos obligatorios.</p>
              )}

              <div className="flex flex-col gap-2">
                {registrationConfig.custom_fields.map((field, i) => (
                  <CustomFieldEditor
                    key={field.id}
                    field={field}
                    isFirst={i === 0}
                    isLast={i === registrationConfig.custom_fields.length - 1}
                    bothTypesEnabled={registrationConfig.registration_types.includes('pair') && registrationConfig.registration_types.includes('individual')}
                    onUpdate={updates => updateCustomField(field.id, updates)}
                    onRemove={() => setPendingDelete({ kind: 'customfield', fieldId: field.id, label: field.label || 'Campo sin nombre' })}
                    onMove={dir => moveCustomField(field.id, dir)}
                  />
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="mt-6 flex flex-col gap-2">
              <p className="text-[12px] font-semibold text-foreground">Enlace para jugadores</p>
              {t.status === 'draft' && (
                <p className="text-[11px] text-[var(--warning)] bg-[var(--warning-surface,#fff7ed)] border border-[var(--warning)]/30 rounded-[6px] px-3 py-2">
                  ⚠️ El torneo está en borrador. Los enlaces estarán activos cuando lo publiques.
                </p>
              )}
              <CopyLinkRow
                label="Formulario de inscripción directo"
                path={`/inscripcion/${t.id as string}`}
                disabled={t.status === 'draft'}
              />
              <CopyLinkRow
                label="Página pública del torneo"
                path={`/t/${t.share_slug as string}`}
                disabled={t.status === 'draft'}
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">
                💡 Comparte estos enlaces con los jugadores. El formulario se mostrará en el idioma del navegador.
              </p>
            </div>
          </div>

          {/* Preview */}
          <RegistrationPreview config={registrationConfig} />
        </div>
      )}

      {pendingDelete && (
        <ConfirmModal
          message={`Se eliminará "${pendingDelete.label}" de forma permanente.`}
          onConfirm={executePendingDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

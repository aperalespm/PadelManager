'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ── Bracket diagram constants ─────────────────────────────────────────────────
const BSLOT = 24
const BMATCH = BSLOT * 2
const BCOL = 106
const BGAP = 22

function schMatchTop(round: number, idx: number): number {
  const pad = BSLOT * (Math.pow(2, round) - 1)
  const gap = BMATCH * (Math.pow(2, round) - 1)
  return pad + idx * (BMATCH + gap)
}

function schMatchCenterY(round: number, idx: number): number {
  return schMatchTop(round, idx) + BSLOT
}

function groupsElimPhases(numGroups: number, teamsAdvance: number): string[] {
  const total = numGroups * teamsAdvance
  const phases = ['Fase de grupos']
  if (total > 8) phases.push('Octavos de final')
  if (total > 4) phases.push('Cuartos de final')
  if (total > 2) phases.push('Semifinal')
  phases.push('Final')
  return phases
}

function localNextPow2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function buildConsolationPhases(consolTeams: number): string[] {
  if (consolTeams < 2) return []
  const depth = Math.ceil(Math.log2(Math.max(consolTeams, 2)))
  const phases: string[] = []
  for (let i = 0; i < depth; i++) {
    const teamsLeft = Math.pow(2, depth - i)
    if (teamsLeft === 2) phases.push('Consol. Final')
    else if (teamsLeft === 4) phases.push('Consol. SF')
    else if (teamsLeft === 8) phases.push('Consol. QF')
    else phases.push(`Consol. R${i + 1}`)
  }
  return phases
}

function BracketDiagram({
  phases,
  matchCounts,
  winnerLabel = 'Campeón',
  winnerEmoji = '🏆',
}: {
  phases: string[]
  matchCounts: number[]
  winnerLabel?: string
  winnerEmoji?: string
}) {
  if (!phases.length) return null

  const totalH = matchCounts[0] * BMATCH
  const CHAMP_W = 52
  const HDR_H = 20

  type Seg = { x1: number; y1: number; x2: number; y2: number }
  const segs: Seg[] = []

  for (let r = 0; r < phases.length - 1; r++) {
    const cx = r * (BCOL + BGAP)
    const nx = (r + 1) * (BCOL + BGAP)
    const midX = cx + BCOL + BGAP / 2
    for (let m = 0; m < matchCounts[r]; m += 2) {
      const y1 = schMatchCenterY(r, m)
      const y2 = schMatchCenterY(r, m + 1)
      const yMid = (y1 + y2) / 2
      segs.push({ x1: cx + BCOL, y1, x2: midX, y2: y1 })
      segs.push({ x1: cx + BCOL, y1: y2, x2: midX, y2: y2 })
      segs.push({ x1: midX, y1, x2: midX, y2 })
      segs.push({ x1: midX, y1: yMid, x2: nx, y2: yMid })
    }
  }
  const lr = phases.length - 1
  const lx = lr * (BCOL + BGAP)
  const champY = schMatchCenterY(lr, 0)
  const champMidX = lx + BCOL + BGAP / 2
  segs.push({ x1: lx + BCOL, y1: champY, x2: champMidX, y2: champY })

  const totalW = phases.length * (BCOL + BGAP) + CHAMP_W

  return (
    <div className="relative shrink-0" style={{ width: totalW, height: totalH + HDR_H }}>
      {phases.map((name, r) => (
        <div key={r}
          className="absolute text-[9px] font-bold uppercase tracking-wide text-center text-muted-foreground overflow-hidden whitespace-nowrap"
          style={{ left: r * (BCOL + BGAP), top: 0, width: BCOL }}>{name}
        </div>
      ))}
      <div className="absolute text-[9px] font-bold uppercase tracking-wide text-center text-muted-foreground"
        style={{ left: lr * (BCOL + BGAP) + BCOL + BGAP / 2 - 8, top: 0, width: CHAMP_W }}>{winnerLabel}</div>

      <svg className="absolute pointer-events-none" style={{ left: 0, top: HDR_H }} width={totalW} height={totalH}>
        {segs.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#cbd5e1" strokeWidth={1.5} />
        ))}
      </svg>

      {phases.map((_, r) =>
        Array.from({ length: matchCounts[r] }, (__, m) => (
          <div key={`${r}-${m}`}
            className="absolute border border-border rounded-[5px] overflow-hidden bg-white"
            style={{ left: r * (BCOL + BGAP), top: HDR_H + schMatchTop(r, m), width: BCOL, height: BMATCH }}>
            <div className="px-2 text-[11px] flex items-center border-b border-border text-muted-foreground/40" style={{ height: BSLOT }}>
              Ganador
            </div>
            <div className="px-2 text-[11px] flex items-center text-muted-foreground/40" style={{ height: BSLOT }}>
              Ganador
            </div>
          </div>
        ))
      )}

      <div className="absolute flex items-center justify-center"
        style={{ left: champMidX, top: HDR_H + schMatchTop(lr, 0) + BSLOT / 2 - 14, width: 28, height: 28 }}>
        <span className="text-[22px] leading-none">{winnerEmoji}</span>
      </div>
    </div>
  )
}

// ── Group card with real pair names ───────────────────────────────────────────

const SLOT_H = 30

function GroupCardFilled({
  label,
  pairs,
  advanceCount,
  isDraft,
}: {
  label: string
  pairs: Array<{ id: string; name: string }>
  advanceCount: number
  isDraft?: boolean
}) {
  return (
    <div className="border border-border rounded-[7px] overflow-hidden shrink-0 w-[180px]">
      <div className="bg-[#1e3a5f] text-white text-[9px] font-bold uppercase tracking-wide py-[5px] text-center">
        {label}
      </div>
      {pairs.map((p, i) => {
        const isSlot = p.id.startsWith('__slot__')
        return (
          <div key={p.id}
            style={{ height: SLOT_H }}
            className={cn(
              'px-2 flex items-center gap-1.5 border-t border-border/40',
              isSlot
                ? 'bg-muted/40'
                : !isDraft && i < advanceCount
                  ? 'bg-[var(--accent-surface)] text-accent font-semibold'
                  : 'bg-white text-muted-foreground'
            )}>
            <span className={cn(
              'text-[9px] shrink-0',
              isSlot ? 'text-border' :
              !isDraft && i < advanceCount ? 'text-[var(--success)] font-bold' : 'text-muted-foreground/50'
            )}>
              {isSlot ? '·' : !isDraft && i < advanceCount ? '✓' : '○'}
            </span>
            <span className={cn(
              'text-[11px] truncate leading-tight',
              isSlot ? 'text-muted-foreground/40 italic' : ''
            )}>
              {p.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

interface GroupBracketViewProps {
  // catMap[categoryLabel][groupLabel] = pairs
  catMap: Record<string, Record<string, Array<{ id: string; name: string }>>>
  numGroups: number
  teamsAdvancePerGroup: number
  isDraft?: boolean
  catFormats?: Record<string, { numGroups: number; teamsPerGroup: number }>
  minMatchesPerTeam?: number
}

export function GroupBracketView({ catMap, numGroups, teamsAdvancePerGroup, isDraft, catFormats, minMatchesPerTeam }: GroupBracketViewProps) {
  const catLabels = Object.keys(catMap).sort()
  const [selCat, setSelCat] = useState(catLabels[0] ?? '')

  // Use per-category format when available
  const catFmt = catFormats?.[selCat]
  const activeNumGroups = catFmt?.numGroups ?? numGroups
  const activeTPG = catFmt?.teamsPerGroup ?? 3

  // Extra-match logic: when group matches alone don't reach the minimum
  const needsExtra = minMatchesPerTeam != null
    && activeTPG > teamsAdvancePerGroup
    && activeTPG - 1 < minMatchesPerTeam
  const directQualifiers = activeNumGroups * teamsAdvancePerGroup
  const extraSpots = localNextPow2(directQualifiers) - directQualifiers
  const elimTeams = needsExtra ? activeNumGroups * (activeTPG - teamsAdvancePerGroup) : 0

  // Wild card: spare KO slots exist → 3rd-placers compete to fill them
  const showWildCard = needsExtra && extraSpots > 0 && elimTeams > 0
  const wcMatchCount = showWildCard ? Math.max(0, elimTeams - extraSpots) : 0

  // Consolation: KO is already full → separate bracket for 3rd-placers
  const showConsolation = needsExtra && extraSpots === 0 && elimTeams >= 2
  const cPhases = showConsolation ? buildConsolationPhases(elimTeams) : []
  const cmc: number[] = []
  let cn = 1
  for (let i = cPhases.length - 1; i >= 0; i--) { cmc[i] = cn; cn *= 2 }

  // KO bracket uses full nextPow2 team count when wild card is active
  const koTeamCount = showWildCard ? localNextPow2(directQualifiers) : directQualifiers

  // Compute elimination phases for the bracket diagram
  const elimPhaseCount = Math.ceil(Math.log2(Math.max(koTeamCount, 2)))
  const elimPhases: string[] = []
  for (let i = 0; i < elimPhaseCount; i++) {
    const teamsLeft = Math.pow(2, elimPhaseCount - i)
    if (teamsLeft === 2) elimPhases.push('Final')
    else if (teamsLeft === 4) elimPhases.push('Semifinal')
    else if (teamsLeft === 8) elimPhases.push('Cuartos de final')
    else if (teamsLeft === 16) elimPhases.push('Octavos de final')
    else elimPhases.push(`Ronda ${teamsLeft}`)
  }
  const mc: number[] = []
  let n = 1
  for (let i = elimPhases.length - 1; i >= 0; i--) { mc[i] = n; n *= 2 }

  const groupMap = catMap[selCat] ?? {}
  const groupLabels = Object.keys(groupMap).sort()
  const cols = Math.max(1, Math.ceil(groupLabels.length / 2))

  const hasMultipleCats = catLabels.length > 1 || (catLabels.length === 1 && catLabels[0] !== '')

  return (
    <div className="w-full">
      {/* Category selector */}
      {hasMultipleCats && (
        <div className="mb-5">
          <select
            value={selCat}
            onChange={e => setSelCat(e.target.value)}
            className="border border-border rounded-[7px] px-3 py-1.5 text-[13px] font-semibold bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {catLabels.map(c => (
              <option key={c} value={c}>{c || 'Todas las parejas'}</option>
            ))}
          </select>
        </div>
      )}

      {groupLabels.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No hay grupos para esta categoría.</p>
      ) : (
        <div className="flex items-start gap-8 overflow-x-auto pb-4">
          {/* Groups grid */}
          <div className="shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Fase de grupos</p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 180px)`, gap: '8px' }}>
              {groupLabels.map(grp => (
                <GroupCardFilled
                  key={grp}
                  label={grp}
                  pairs={groupMap[grp]}
                  advanceCount={teamsAdvancePerGroup}
                  isDraft={isDraft}
                />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Top {teamsAdvancePerGroup} por grupo · {groupLabels.length * teamsAdvancePerGroup} clasificados
            </p>
          </div>

          {/* Arrow */}
          <div className="flex items-center self-center shrink-0 text-muted-foreground text-lg pt-4">→</div>

          {/* Elimination bracket + optional wild card / consolation */}
          <div className="shrink-0 flex flex-col gap-6">
            {/* Wild card: shown before the main KO when spare slots exist */}
            {showWildCard && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--warning)]">Repechaje</p>
                  <span className="text-[9px] text-muted-foreground">
                    · {wcMatchCount} partido{wcMatchCount !== 1 ? 's' : ''}{extraSpots - wcMatchCount > 0 ? ` + ${extraSpots - wcMatchCount} bye` : ''} → 8°s de final
                  </span>
                </div>
                {wcMatchCount > 0 && (
                  <BracketDiagram phases={['Repechaje']} matchCounts={[wcMatchCount]} winnerLabel="→ cuartos" winnerEmoji="→" />
                )}
              </div>
            )}
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Eliminatoria</p>
              <BracketDiagram phases={elimPhases} matchCounts={mc} />
            </div>
            {/* Consolation: shown when KO is full and 3rd-placers need extra matches */}
            {showConsolation && cPhases.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--warning)]">Consolación</p>
                  <span className="text-[9px] text-muted-foreground">· {elimTeams} equipos eliminados</span>
                </div>
                <BracketDiagram
                  phases={cPhases}
                  matchCounts={cmc}
                  winnerLabel="3er puesto"
                  winnerEmoji="🥉"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

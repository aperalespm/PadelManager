'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TournamentSchedule } from '@/lib/types/schedule'

const CATEGORY_COLORS: Array<{ bg: string; text: string; border: string }> = [
  { bg: 'bg-[var(--accent-surface)]',   text: 'text-accent',             border: 'border-accent/30' },
  { bg: 'bg-[var(--success-surface)]',  text: 'text-[var(--success)]',   border: 'border-[var(--success)]/30' },
  { bg: 'bg-[var(--amber-surface)]',    text: 'text-[var(--amber)]',     border: 'border-[var(--amber)]/30' },
  { bg: 'bg-[var(--waitlist-surface)]', text: 'text-[var(--waitlist)]',  border: 'border-[var(--waitlist)]/30' },
  { bg: 'bg-[var(--error-surface)]',    text: 'text-[var(--error)]',     border: 'border-[var(--error)]/30' },
]

const PX_PER_MIN = 2  // 30-min match = 60px, 60-min = 120px

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface ScheduleCalendarProps {
  schedule: TournamentSchedule
}

export function ScheduleCalendar({ schedule }: ScheduleCalendarProps) {
  const { matches } = schedule
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  if (!matches.length) return (
    <p className="text-sm text-muted-foreground text-center py-8">Sin partidos en el horario</p>
  )

  // Build category index (preserve insertion order)
  const catIds: string[] = []
  const catNames: Record<string, string> = {}
  for (const m of matches) {
    if (!catIds.includes(m.categoryId)) {
      catIds.push(m.categoryId)
      catNames[m.categoryId] = m.categoryName
    }
  }

  const catColorMap: Record<string, typeof CATEGORY_COLORS[0]> = {}
  catIds.forEach((id, i) => { catColorMap[id] = CATEGORY_COLORS[i % CATEGORY_COLORS.length] })

  // Apply category filter
  const visible = selectedCats.size === 0
    ? matches
    : matches.filter(m => selectedCats.has(m.categoryId))

  // Courts in order of first appearance among visible matches
  const courtsOrdered: Array<{ number: number; name: string }> = []
  const courtSeen = new Set<number>()
  for (const m of visible) {
    if (!courtSeen.has(m.courtNumber)) {
      courtsOrdered.push({ number: m.courtNumber, name: m.courtName })
      courtSeen.add(m.courtNumber)
    }
  }

  // Compute time range from all matches (not just visible, to keep axis stable)
  const allMins = matches.flatMap(m => [timeToMinutes(m.startTime), timeToMinutes(m.endTime)])
  const rangeStart = Math.floor(Math.min(...allMins) / 30) * 30
  const rangeEnd   = Math.ceil(Math.max(...allMins)  / 30) * 30
  const totalHeight = (rangeEnd - rangeStart) * PX_PER_MIN

  // Time axis ticks every 30 minutes
  const ticks: number[] = []
  for (let t = rangeStart; t <= rangeEnd; t += 30) ticks.push(t)

  // Matches per court for fast lookup
  const byCourt: Record<number, typeof matches> = {}
  for (const m of visible) {
    if (!byCourt[m.courtNumber]) byCourt[m.courtNumber] = []
    byCourt[m.courtNumber].push(m)
  }

  function toggleCat(id: string) {
    setSelectedCats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filterLabel = selectedCats.size === 0
    ? 'Todas las categorías'
    : selectedCats.size === 1
    ? catNames[Array.from(selectedCats)[0]]
    : `${selectedCats.size} categorías seleccionadas`

  return (
    <div className="flex flex-col gap-3">

      {/* ── Category filter ────────────────────────────────────────── */}
      <div className="relative w-fit" ref={filterRef}>
        <button
          onClick={() => setFilterOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] border border-border bg-background text-[13px] hover:bg-muted transition-colors"
        >
          <span className="text-muted-foreground text-[12px] font-semibold uppercase tracking-wide">Categoría</span>
          <span className="text-foreground font-medium">{filterLabel}</span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform duration-150', filterOpen && 'rotate-180')} />
        </button>

        {filterOpen && (
          <div className="absolute top-full left-0 mt-1.5 z-30 bg-card border border-border rounded-[10px] shadow-xl p-1.5 min-w-[220px]">
            {/* "Todas" option */}
            <button
              onClick={() => setSelectedCats(new Set())}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-[7px] text-[13px] transition-colors',
                selectedCats.size === 0 ? 'bg-accent/10 text-accent font-semibold' : 'text-muted-foreground hover:bg-muted font-medium'
              )}
            >
              <span className={cn('w-4 h-4 rounded-[4px] border-2 flex items-center justify-center shrink-0',
                selectedCats.size === 0 ? 'bg-accent border-accent' : 'border-border'
              )}>
                {selectedCats.size === 0 && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              Todas las categorías
            </button>

            <div className="my-1 border-t border-border/60" />

            {catIds.map(id => {
              const colors = catColorMap[id]
              const active = selectedCats.has(id)
              return (
                <button
                  key={id}
                  onClick={() => toggleCat(id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-[7px] text-[13px] transition-colors font-medium',
                    active ? `${colors.bg} ${colors.text}` : 'text-foreground hover:bg-muted'
                  )}
                >
                  <span className={cn('w-4 h-4 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-colors',
                    active ? `${colors.border} ${colors.bg}` : 'border-border'
                  )}>
                    {active && <Check className={cn('w-2.5 h-2.5', colors.text)} />}
                  </span>
                  {catNames[id]}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Proportional time grid ─────────────────────────────────── */}
      {courtsOrdered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hay partidos para las categorías seleccionadas</p>
      ) : (
        <div className="w-full overflow-x-auto overflow-y-auto max-h-[640px] rounded-lg border border-border">
          <div className="flex" style={{ minWidth: `${courtsOrdered.length * 170 + 52}px` }}>

            {/* Time axis */}
            <div className="w-[52px] shrink-0 relative" style={{ height: `${totalHeight + 28}px` }}>
              {/* Header spacer */}
              <div className="h-7 border-b border-border/60 bg-card" />
              {/* Ticks */}
              <div className="relative" style={{ height: `${totalHeight}px` }}>
                {ticks.map(t => (
                  <div
                    key={t}
                    className="absolute left-0 right-0 flex items-center"
                    style={{ top: `${(t - rangeStart) * PX_PER_MIN}px` }}
                  >
                    <span className="text-[10px] font-mono text-muted-foreground pl-2 leading-none bg-card pr-1">
                      {minutesToLabel(t)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Court columns */}
            {courtsOrdered.map((court, ci) => (
              <div
                key={court.number}
                className={cn('flex-1 min-w-[170px]', ci > 0 && 'border-l border-border/40')}
                style={{ height: `${totalHeight + 28}px` }}
              >
                {/* Header */}
                <div className="h-7 flex items-center justify-center border-b border-border/60 bg-card sticky top-0 z-10">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {court.name}
                  </span>
                </div>

                {/* Match cards (absolutely positioned) */}
                <div className="relative" style={{ height: `${totalHeight}px` }}>
                  {/* Hour grid lines */}
                  {ticks.map(t => (
                    <div
                      key={t}
                      className={cn(
                        'absolute left-0 right-0 border-t',
                        t % 60 === 0 ? 'border-border/30' : 'border-border/10'
                      )}
                      style={{ top: `${(t - rangeStart) * PX_PER_MIN}px` }}
                    />
                  ))}

                  {/* Matches */}
                  {(byCourt[court.number] ?? []).map(m => {
                    const startMin = timeToMinutes(m.startTime)
                    const endMin   = timeToMinutes(m.endTime)
                    const top    = (startMin - rangeStart) * PX_PER_MIN + 2
                    const height = (endMin - startMin) * PX_PER_MIN - 4
                    const colors = catColorMap[m.categoryId] ?? CATEGORY_COLORS[0]
                    const isPhase = m.phase !== 'groups'

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'absolute left-1 right-1 rounded-[6px] border px-2 py-1 overflow-hidden flex flex-col',
                          colors.bg, colors.border,
                          isPhase && 'border-t-2 border-t-foreground/30'
                        )}
                        style={{ top, height }}
                      >
                        <p className={cn('text-[10px] font-bold truncate leading-tight shrink-0', colors.text)}>
                          {m.categoryName}
                          {isPhase && <span className="ml-1 opacity-60">· {m.phase}</span>}
                        </p>
                        {height >= 32 && (
                          <p className="text-[11px] text-foreground/80 truncate leading-tight mt-0.5 shrink-0">
                            {m.pair1} — {m.pair2}
                          </p>
                        )}
                        {height >= 48 && (
                          <p className="text-[10px] text-muted-foreground leading-tight mt-auto shrink-0">
                            {m.startTime}–{m.endTime}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

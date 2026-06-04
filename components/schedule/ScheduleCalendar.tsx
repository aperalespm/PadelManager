'use client'

import { cn } from '@/lib/utils'
import type { TournamentSchedule } from '@/lib/types/schedule'

// CSS token pairs per category index (surface + text)
const CATEGORY_COLORS: Array<{ bg: string; text: string; border: string }> = [
  { bg: 'bg-[var(--accent-surface)]',   text: 'text-accent',             border: 'border-accent/30' },
  { bg: 'bg-[var(--success-surface)]',  text: 'text-[var(--success)]',   border: 'border-[var(--success)]/30' },
  { bg: 'bg-[var(--amber-surface)]',    text: 'text-[var(--amber)]',     border: 'border-[var(--amber)]/30' },
  { bg: 'bg-[var(--waitlist-surface)]', text: 'text-[var(--waitlist)]',  border: 'border-[var(--waitlist)]/30' },
  { bg: 'bg-[var(--error-surface)]',    text: 'text-[var(--error)]',     border: 'border-[var(--error)]/30' },
]

interface ScheduleCalendarProps {
  schedule: TournamentSchedule
}

export function ScheduleCalendar({ schedule }: ScheduleCalendarProps) {
  const { matches } = schedule

  if (!matches.length) return (
    <p className="text-sm text-muted-foreground text-center py-8">Sin partidos en el horario</p>
  )

  // Build court list preserving order of appearance
  const courtsOrdered: Array<{ number: number; name: string }> = []
  const courtSeen = new Set<number>()
  for (const m of matches) {
    if (!courtSeen.has(m.courtNumber)) {
      courtsOrdered.push({ number: m.courtNumber, name: m.courtName })
      courtSeen.add(m.courtNumber)
    }
  }

  // Build time slot list (unique startTimes, sorted)
  const timesSet = new Set<string>()
  for (const m of matches) timesSet.add(m.startTime)
  const times = Array.from(timesSet).sort()

  // Build category color map
  const catIds: string[] = []
  for (const m of matches) {
    if (!catIds.includes(m.categoryId)) catIds.push(m.categoryId)
  }
  const catColorMap: Record<string, typeof CATEGORY_COLORS[0]> = {}
  catIds.forEach((id, i) => { catColorMap[id] = CATEGORY_COLORS[i % CATEGORY_COLORS.length] })

  // Build lookup: time → courtNumber → match
  const matchMap: Record<string, Record<number, typeof matches[0]>> = {}
  for (const m of matches) {
    if (!matchMap[m.startTime]) matchMap[m.startTime] = {}
    matchMap[m.startTime][m.courtNumber] = m
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground w-16 sticky left-0 bg-card">
              Hora
            </th>
            {courtsOrdered.map(c => (
              <th key={c.number} className="text-center px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground min-w-[130px]">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map(time => {
            const rowMatches = matchMap[time] ?? {}
            const hasAnyMatch = courtsOrdered.some(c => rowMatches[c.number])

            return (
              <tr key={time} className="border-b border-border/50">
                <td className="px-3 py-1 font-mono text-[11px] text-muted-foreground align-top sticky left-0 bg-card">
                  {time}
                </td>
                {courtsOrdered.map(c => {
                  const m = rowMatches[c.number]
                  if (!m) {
                    return (
                      <td key={c.number} className="px-2 py-1">
                        {hasAnyMatch && <div className="h-[52px]" />}
                      </td>
                    )
                  }
                  const colors = catColorMap[m.categoryId] ?? CATEGORY_COLORS[0]
                  const isPhase = m.phase !== 'groups'
                  return (
                    <td key={c.number} className="px-1.5 py-1">
                      <div className={cn(
                        'rounded-[6px] border px-2 py-1.5 h-[52px] flex flex-col justify-between',
                        colors.bg, colors.border,
                        isPhase && 'border-t-2 border-t-foreground/30'
                      )}>
                        <p className={cn('text-[10px] font-bold truncate leading-tight', colors.text)}>
                          {m.categoryName}
                          {isPhase && <span className="ml-1 opacity-60">· {m.phase}</span>}
                        </p>
                        <p className="text-[11px] text-foreground/80 truncate leading-tight">{m.matchLabel}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{m.startTime}–{m.endTime}</p>
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

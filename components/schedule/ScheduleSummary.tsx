'use client'

import { AlertTriangle } from 'lucide-react'
import type { ScheduleSummary } from '@/lib/types/schedule'

interface ScheduleSummaryProps {
  summary: ScheduleSummary
}

export function ScheduleSummaryBar({ summary }: ScheduleSummaryProps) {
  const categories = Object.keys(summary.matchesPerCategory)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        {categories.map(cat => (
          <div key={cat} className="flex items-center gap-2 bg-card border border-border rounded-[8px] px-3 py-2 min-w-[140px]">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide truncate">{cat}</p>
              <p className="text-[13px] font-semibold text-foreground mt-0.5">
                {summary.matchesPerCategory[cat]} partidos
              </p>
              {summary.finalTimes[cat] && (
                <p className="text-[11px] text-muted-foreground">Final ~{summary.finalTimes[cat]}</p>
              )}
            </div>
            {summary.warnings.some(w => w.toLowerCase().includes(cat.toLowerCase())) && (
              <AlertTriangle className="w-4 h-4 text-[var(--amber)] shrink-0" />
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 bg-[var(--accent-surface)] border border-accent/20 rounded-[8px] px-3 py-2 min-w-[120px]">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-[13px] font-semibold text-accent">{summary.totalMatches} partidos</p>
            <p className="text-[11px] text-muted-foreground">Fin ~{summary.estimatedEndTime}</p>
          </div>
        </div>
      </div>
      {summary.warnings.length > 0 && (
        <div className="bg-[var(--amber-surface)] border border-[var(--amber)]/30 rounded-[8px] px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--amber)] shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            {summary.warnings.map((w, i) => (
              <p key={i} className="text-[12px] text-[var(--amber)]">{w}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

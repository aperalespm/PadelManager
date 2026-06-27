'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { ScheduleDistribution, DistributionBin } from '@/lib/types/schedule'

interface Category {
  id: string
  name: string
}

interface Props {
  categories: Category[]
  numCourts: number
  distribution: ScheduleDistribution | null
  onChange: (d: ScheduleDistribution) => void
  disabled?: boolean
}

// Ensure all categories are assigned; return canonical bin list
function normalise(dist: ScheduleDistribution | null, cats: Category[]): DistributionBin[] {
  const defaultBin: DistributionBin = { id: 'bin_default', categoryIds: cats.map(c => c.id) }
  if (!dist || dist.bins.length === 0) return [defaultBin]

  const assigned = new Set(dist.bins.flatMap(b => b.categoryIds))
  const orphans  = cats.filter(c => !assigned.has(c.id)).map(c => c.id)
  if (orphans.length === 0) return dist.bins

  return [
    { ...dist.bins[0], categoryIds: [...dist.bins[0].categoryIds, ...orphans] },
    ...dist.bins.slice(1),
  ]
}


export function DistributionConfigurator({ categories, numCourts, distribution, onChange, disabled }: Props) {
  const bins           = normalise(distribution, categories)
  const mode           = distribution?.mode ?? 'complete'
  const groupsSched    = distribution?.groupsScheduling ?? 'shared'
  const multi          = bins.length > 1
  const showGroupsMode = numCourts > 0 && numCourts === categories.length

  const dragCat = useRef<string | null>(null)

  function emit(newBins: DistributionBin[], newMode?: 'complete' | 'by_phase', newGroupsSched?: 'parallel' | 'shared') {
    onChange({ bins: newBins, mode: newMode ?? mode, groupsScheduling: newGroupsSched ?? groupsSched })
  }

  function addBin() {
    // Add empty bin — don't touch existing assignments
    emit([...bins, { id: `bin_${Date.now()}`, categoryIds: [] }])
  }

  function removeBin(binId: string) {
    if (bins.length <= 1) return
    // Move any cats from the removed bin to the first surviving bin
    const removed   = bins.find(b => b.id === binId)
    const remaining = bins.filter(b => b.id !== binId)
    if (removed && removed.categoryIds.length > 0) {
      remaining[0] = { ...remaining[0], categoryIds: [...remaining[0].categoryIds, ...removed.categoryIds] }
    }
    emit(remaining)
  }

  function moveCat(catId: string, toBinId: string) {
    // Remove from every bin, add to target — empty bins are allowed
    const newBins = bins.map(b => ({
      ...b,
      categoryIds: b.id === toBinId
        ? b.categoryIds.includes(catId) ? b.categoryIds : [...b.categoryIds, catId]
        : b.categoryIds.filter(id => id !== catId),
    }))
    emit(newBins)
  }

  return (
    <div className={cn('space-y-3', disabled && 'opacity-50 pointer-events-none')}>

      {/* Mode toggle — only visible when 2+ bins */}
      {multi && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-medium">Modo:</span>
          <div className="flex items-center rounded-full border border-border overflow-hidden text-[11px] font-medium">
            <button
              onClick={() => emit(bins, 'complete')}
              className={cn(
                'px-3 py-1 transition-colors',
                mode === 'complete'
                  ? 'bg-accent text-white'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              Torneo completo
            </button>
            <button
              onClick={() => emit(bins, 'by_phase')}
              className={cn(
                'px-3 py-1 border-l border-border transition-colors',
                mode === 'by_phase'
                  ? 'bg-accent text-white'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              Por fases
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {mode === 'complete'
              ? 'Cada grupo completa grupos + eliminatorias antes del siguiente'
              : 'Todos los grupos primero, luego todas las eliminatorias'}
          </span>
        </div>
      )}

      {/* Groups scheduling — only visible when numCourts === numCats */}
      {showGroupsMode && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-medium">Grupos:</span>
          <div className="flex items-center rounded-full border border-border overflow-hidden text-[11px] font-medium">
            <button
              onClick={() => emit(bins, undefined, 'parallel')}
              className={cn(
                'px-3 py-1 transition-colors',
                groupsSched === 'parallel'
                  ? 'bg-accent text-white'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              Por categoría
            </button>
            <button
              onClick={() => emit(bins, undefined, 'shared')}
              className={cn(
                'px-3 py-1 border-l border-border transition-colors',
                groupsSched === 'shared'
                  ? 'bg-accent text-white'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              Compartidas
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {groupsSched === 'parallel'
              ? 'Cada categoría en su propia pista durante grupos'
              : 'Partidos de grupos rotando por todas las pistas'}
          </span>
        </div>
      )}

      {/* Bins */}
      <div className="flex flex-col gap-2">
        {bins.map((bin, binIdx) => {
          const binCats = bin.categoryIds
            .map(id => categories.find(c => c.id === id))
            .filter((c): c is Category => !!c)

          return (
            <div
              key={bin.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragCat.current) moveCat(dragCat.current, bin.id)
                dragCat.current = null
              }}
              className="border border-border rounded-[8px] p-2.5 bg-card space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Bloque {binIdx + 1}
                </span>
                {bins.length > 1 && (
                  <button
                    onClick={() => removeBin(bin.id)}
                    title="Eliminar bloque"
                    className="text-[11px] text-muted-foreground hover:text-foreground leading-none"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {binCats.map(cat => (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={() => { dragCat.current = cat.id }}
                    onDragEnd={() => { dragCat.current = null }}
                    className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-[var(--accent-surface)] text-accent border border-accent/20 cursor-grab select-none"
                    title="Arrastra para mover de bloque"
                  >
                    {cat.name}
                  </div>
                ))}
                {binCats.length === 0 && (
                  <span className="text-[10px] text-muted-foreground italic">Arrastra categorías aquí</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={addBin}
        className="text-[12px] text-accent hover:underline font-medium"
      >
        + Añadir bloque
      </button>
    </div>
  )
}

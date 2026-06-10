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

// Redistribute all categories as evenly as possible across existing bin IDs
function redistribute(cats: Category[], binIds: string[]): DistributionBin[] {
  const bins: DistributionBin[] = binIds.map(id => ({ id, categoryIds: [] }))
  cats.forEach((cat, i) => { bins[i % bins.length].categoryIds.push(cat.id) })
  return bins
}

export function DistributionConfigurator({ categories, distribution, onChange, disabled }: Props) {
  const bins  = normalise(distribution, categories)
  const mode  = distribution?.mode ?? 'complete'
  const multi = bins.length > 1

  const dragCat = useRef<string | null>(null)

  function emit(newBins: DistributionBin[], newMode?: 'complete' | 'by_phase') {
    onChange({ bins: newBins, mode: newMode ?? mode })
  }

  function addBin() {
    const newId   = `bin_${Date.now()}`
    const newBins = redistribute(categories, [...bins.map(b => b.id), newId])
    emit(newBins)
  }

  function removeBin(binId: string) {
    if (bins.length <= 1) return
    const remaining = bins.filter(b => b.id !== binId)
    const newBins   = redistribute(categories, remaining.map(b => b.id))
    emit(newBins)
  }

  function moveCat(catId: string, toBinId: string) {
    const newBins = bins.map(b => ({
      ...b,
      categoryIds: b.id === toBinId
        ? b.categoryIds.includes(catId) ? b.categoryIds : [...b.categoryIds, catId]
        : b.categoryIds.filter(id => id !== catId),
    }))
    // Remove empty bins (except if only 1 left)
    const nonEmpty = newBins.filter(b => b.categoryIds.length > 0)
    emit(nonEmpty.length > 0 ? nonEmpty : newBins)
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

      {/* Bins */}
      <div className="flex gap-2 flex-wrap">
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
              className="flex-1 min-w-[140px] border border-border rounded-[8px] p-2.5 bg-card space-y-2"
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

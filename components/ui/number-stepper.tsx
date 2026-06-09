'use client'

import { cn } from '@/lib/utils'

interface NumberStepperProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

export function NumberStepper({ value, onChange, min = 0, max = 9999, step = 1, className }: NumberStepperProps) {
  function inc() { onChange(Math.min(max, value + step)) }
  function dec() { onChange(Math.max(min, value - step)) }

  return (
    <div className={cn('flex items-stretch h-9 rounded-md border border-input overflow-hidden bg-background', className)}>
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className="w-9 shrink-0 flex items-center justify-center border-r border-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 text-lg font-medium select-none"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value === 0 ? '' : String(value)}
        onFocus={e => e.currentTarget.select()}
        onChange={e => {
          const raw = e.target.value.replace(/\D/g, '')
          if (raw === '') { onChange(min); return }
          const v = parseInt(raw, 10)
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
        onBlur={e => {
          const v = parseInt(e.target.value.replace(/\D/g, ''), 10)
          onChange(isNaN(v) || v < min ? min : v > max ? max : v)
        }}
        className="flex-1 text-center text-sm bg-transparent outline-none min-w-0 px-1"
      />
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        className="w-9 shrink-0 flex items-center justify-center border-l border-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 text-lg font-medium select-none"
      >
        +
      </button>
    </div>
  )
}

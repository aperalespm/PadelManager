'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage, TournamentSchedule } from '@/lib/types/schedule'

interface ScheduleChatProps {
  messages: ChatMessage[]
  isGenerating: boolean
  onSend: (text: string) => void
}

export function ScheduleChat({ messages, isGenerating, onSend }: ScheduleChatProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isGenerating) return
    setInput('')
    onSend(text)
  }

  /*
   * Grid "minmax(0,1fr) auto": messages take all remaining height
   * (bounded by minmax(0,...) → actually scrolls), input bar pinned at
   * the bottom (auto). height:100% fills the parent grid track.
   */
  return (
    <div
      className="overflow-hidden"
      style={{ display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', height: '100%' }}
    >
      {/* Messages — 1fr, scrolls */}
      <div className="overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
            <div className={cn(
              'max-w-[85%] rounded-[10px] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap',
              msg.role === 'user'
                ? 'bg-muted text-foreground'
                : 'bg-card border border-border text-foreground'
            )}>
              {msg.content}
            </div>
            {msg.role === 'assistant' && (msg as ChatMessage & { schedule?: TournamentSchedule }).schedule && (
              <span className="text-[11px] font-semibold text-[var(--success)] mt-1 px-1">
                ✓ Horario actualizado
              </span>
            )}
            <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
              {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-start">
            <div className="bg-card border border-border rounded-[10px] px-3.5 py-2.5">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar — auto, fixed at bottom */}
      <form onSubmit={handleSubmit} className="border-t border-border px-4 py-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isGenerating}
          placeholder="Pide un ajuste... (ej: 'finales a las 20:00')"
          className="flex-1 bg-muted rounded-[8px] px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isGenerating || !input.trim()}
          className="flex items-center justify-center w-9 h-9 rounded-[8px] bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-opacity shrink-0"
        >
          {isGenerating
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </form>
    </div>
  )
}

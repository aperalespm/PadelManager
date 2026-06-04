'use client'

import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { chatWithScheduleAgent, saveSchedule, publishSchedule } from '@/lib/actions/schedule-agent'
import { ScheduleChat } from '@/components/schedule/ScheduleChat'
import { ScheduleCalendar } from '@/components/schedule/ScheduleCalendar'
import { ScheduleSummaryBar } from '@/components/schedule/ScheduleSummary'
import { cn } from '@/lib/utils'
import type { ChatMessage, TournamentSchedule } from '@/lib/types/schedule'

interface ScheduleAgentProps {
  tournamentId: string
  tournamentName: string
  tournamentConfig: Record<string, unknown>
  initialMessages: ChatMessage[]
  initialSchedule: TournamentSchedule | null
  initialIsPublished: boolean
  initialVersion: number
}

export function ScheduleAgent({
  tournamentId,
  tournamentName,
  tournamentConfig,
  initialMessages,
  initialSchedule,
  initialIsPublished,
  initialVersion,
}: ScheduleAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [schedule, setSchedule] = useState<TournamentSchedule | null>(initialSchedule)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublished, setIsPublished] = useState(initialIsPublished)
  const [version, setVersion] = useState(initialVersion)
  const [saveError, setSaveError] = useState<string | null>(null)

  const hasHistory = messages.length > 0

  async function sendMessage(text: string) {
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setIsGenerating(true)
    setSaveError(null)

    const result = await chatWithScheduleAgent({
      tournamentId,
      userMessage: text,
      conversationHistory: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      tournamentConfig,
    })

    if ('error' in result) {
      setMessages(prev => [...prev, { role: 'assistant', content: result.error, timestamp: new Date().toISOString() }])
      setIsGenerating(false)
      return
    }

    const { message, schedule: newSchedule } = result.data
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: message,
      schedule: newSchedule ?? undefined,
      timestamp: new Date().toISOString(),
    }
    const updatedMessages = [...newMessages, assistantMsg]
    setMessages(updatedMessages)
    if (newSchedule) setSchedule(newSchedule)
    setIsGenerating(false)

    const scheduleToSave = newSchedule ?? schedule
    if (scheduleToSave) {
      setIsSaving(true)
      await saveSchedule({
        tournamentId,
        scheduleData: scheduleToSave as unknown as Record<string, unknown>,
        messages: updatedMessages as unknown as Record<string, unknown>[],
      })
      setVersion(v => v + 1)
      setIsSaving(false)
    }
  }

  async function handleSave() {
    if (!schedule) return
    setIsSaving(true)
    setSaveError(null)
    const result = await saveSchedule({
      tournamentId,
      scheduleData: schedule as unknown as Record<string, unknown>,
      messages: messages as unknown as Record<string, unknown>[],
    })
    if ('error' in result) setSaveError(result.error)
    else setVersion(v => v + 1)
    setIsSaving(false)
  }

  async function handlePublish() {
    if (!schedule) return
    await handleSave()
    const result = await publishSchedule(tournamentId)
    if (!('error' in result)) setIsPublished(true)
  }

  /*
   * LAYOUT — the only reliable recipe for independent column scroll
   * ────────────────────────────────────────────────────────────────
   * Root:    height:100vh (zero parent dependency), grid 2 columns.
   * Column:  grid rows "auto minmax(0,1fr)".
   *          ⚠️ minmax(0,1fr) — NOT 1fr. Plain `1fr` == minmax(AUTO,1fr),
   *          and the `auto` minimum lets the track grow past its share to
   *          fit content, so overflow never has a bounded box to scroll in.
   *          minmax(0,...) pins the minimum to 0 → track == remaining space.
   * Body:    overflow-y-auto inside the minmax(0,1fr) track → scrolls.
   */
  return (
    <div
      className="bg-background"
      style={{
        height: '100vh',
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 2fr) 3fr',
        overflow: 'hidden',
      }}
    >
      {/* ── Left column: chat ─────────────────────────────────────── */}
      <div
        className="border-r border-border overflow-hidden"
        style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minWidth: 0 }}
      >
        {/* Header — auto */}
        <div className="px-5 py-4 border-b border-border">
          <h1 className="text-[18px] font-extrabold text-foreground tracking-[-0.4px]">Horario</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">{tournamentName}</p>
        </div>

        {/* Body — minmax(0,1fr), bounded → scrolls */}
        {!hasHistory ? (
          <div className="overflow-y-auto flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-surface)] flex items-center justify-center">
              <Calendar className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-foreground">Sin horario generado</p>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-[240px]">
                El agente generará el horario óptimo basándose en la configuración del torneo.
              </p>
            </div>
            <button
              onClick={() => sendMessage('Genera el horario óptimo para este torneo.')}
              disabled={isGenerating}
              className="px-5 py-2.5 bg-accent text-white text-[13px] font-semibold rounded-[8px] hover:bg-accent/90 disabled:opacity-50 transition-opacity"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generando...
                </span>
              ) : 'Generar horario'}
            </button>
          </div>
        ) : (
          <ScheduleChat messages={messages} isGenerating={isGenerating} onSend={sendMessage} />
        )}
      </div>

      {/* ── Right column: calendar ─────────────────────────────────── */}
      <div
        className="overflow-hidden"
        style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minWidth: 0 }}
      >
        {/* Actions bar — auto */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--accent-surface)] text-accent border border-accent/20">
              Planificación
            </span>
            {version > 0 && <span className="text-[11px] text-muted-foreground">v{version}</span>}
            {isSaving && <span className="text-[11px] text-muted-foreground">Guardando...</span>}
            {saveError && <span className="text-[11px] text-[var(--error)]">{saveError}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!schedule || isSaving}
              className={cn(
                'px-3 py-1.5 text-[12px] font-semibold rounded-[7px] border border-border transition-colors',
                schedule ? 'hover:bg-muted text-foreground' : 'opacity-40 cursor-not-allowed text-muted-foreground'
              )}
            >
              Guardar
            </button>
            <button
              onClick={handlePublish}
              disabled={!schedule || isSaving || isPublished}
              className={cn(
                'px-3 py-1.5 text-[12px] font-semibold rounded-[7px] transition-colors',
                isPublished
                  ? 'bg-[var(--success-surface)] text-[var(--success)] border border-[var(--success)]/30 cursor-default'
                  : schedule
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'bg-accent/40 text-white cursor-not-allowed'
              )}
            >
              {isPublished ? '✓ Publicado' : 'Publicar'}
            </button>
          </div>
        </div>

        {/* Calendar content — minmax(0,1fr), bounded → scrolls */}
        <div className="overflow-y-auto p-5 flex flex-col gap-4">
          {schedule ? (
            <>
              <ScheduleSummaryBar summary={schedule.summary} />
              <div className="bg-card border border-border rounded-[10px] overflow-hidden">
                <ScheduleCalendar schedule={schedule} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-24 text-center">
              <div>
                <Calendar className="w-10 h-10 text-muted-foreground/40 mb-3 mx-auto" />
                <p className="text-[14px] font-semibold text-muted-foreground">Sin horario</p>
                <p className="text-[12px] text-muted-foreground/70 mt-1">El horario generado aparecerá aquí</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

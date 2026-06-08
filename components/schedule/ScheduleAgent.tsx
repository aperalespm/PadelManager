'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, Clock, Maximize2, X } from 'lucide-react'
import { chatWithScheduleAgent, saveSchedule, publishSchedule } from '@/lib/actions/schedule-agent'
import type { VersionSnapshot } from '@/lib/actions/schedule-agent'
import { ScheduleChat } from '@/components/schedule/ScheduleChat'
import { ScheduleCalendar } from '@/components/schedule/ScheduleCalendar'
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
  initialVersionHistory: VersionSnapshot[]
  autoRegenerate?: boolean
  tournamentUpdatedAt?: string | null
  scheduleUpdatedAt?: string | null
  lastRegistrationAt?: string | null
}

export function ScheduleAgent({
  tournamentId,
  tournamentName,
  tournamentConfig,
  initialMessages,
  initialSchedule,
  initialIsPublished,
  initialVersion,
  initialVersionHistory,
  autoRegenerate,
  tournamentUpdatedAt,
  scheduleUpdatedAt,
  lastRegistrationAt,
}: ScheduleAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [schedule, setSchedule] = useState<TournamentSchedule | null>(initialSchedule)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublished, setIsPublished] = useState(initialIsPublished)
  const [version, setVersion] = useState(initialVersion)
  const [versionHistory, setVersionHistory] = useState<VersionSnapshot[]>(initialVersionHistory)
  const [currentScheduleUpdatedAt, setCurrentScheduleUpdatedAt] = useState(scheduleUpdatedAt)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)
  const [chatWidth, setChatWidth] = useState(400)
  const dragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(0)

  useEffect(() => {
    if (!autoRegenerate) return
    const msg = isAssignment
      ? 'Regenera el horario completo usando las parejas inscritas actuales, respetando los ajustes de sesiones anteriores si los hay.'
      : 'Regenera el horario completo con la configuración actualizada del torneo, respetando los ajustes de sesiones anteriores si los hay.'
    sendMessage(msg, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — run once on mount

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      const delta = e.clientX - dragStartX.current
      setChatWidth(Math.max(260, Math.min(680, dragStartW.current + delta)))
    }
    function onUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  useEffect(() => {
    if (!showHistory) return
    function onDown(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) setShowHistory(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showHistory])

  // null → live schedule; number → preview of that version index in history
  const displayedSchedule = previewIndex !== null
    ? (versionHistory[previewIndex]?.schedule ?? null)
    : schedule

  async function handleRestore(idx: number) {
    const v = versionHistory[idx]
    if (!v) return
    setSchedule(v.schedule)
    setPreviewIndex(null)
    setIsSaving(true)
    const result = await saveSchedule({
      tournamentId,
      scheduleData: v.schedule as unknown as Record<string, unknown>,
      messages: messages as unknown as Record<string, unknown>[],
      versionLabel: `Restaurado v${v.version}`,
    })
    if ('data' in result) {
      const savedAt = new Date().toISOString()
      setCurrentScheduleUpdatedAt(savedAt)
      setVersion(result.data.version)
      setVersionHistory(prev => [
        ...prev,
        { version: result.data.version, savedAt, label: `Restaurado v${v.version}`, schedule: v.schedule },
      ].slice(-25))
    }
    setIsSaving(false)
  }

  const tournamentStatus = (tournamentConfig.tournamentStatus as string) ?? 'draft'
  const mode = tournamentStatus === 'active' ? 'En vivo'
    : tournamentStatus === 'open' ? 'Asignación'
    : 'Planificación'
  const isAssignment = tournamentStatus === 'open' || tournamentStatus === 'active'

  const hasHistory = messages.length > 0

  // Config changed after last schedule save
  const configChanged = !!(
    schedule && currentScheduleUpdatedAt && tournamentUpdatedAt &&
    new Date(tournamentUpdatedAt) > new Date(currentScheduleUpdatedAt)
  )
  // New confirmed registrations confirmed/updated since last schedule save
  const registrationsChanged = !!(
    schedule && currentScheduleUpdatedAt && lastRegistrationAt &&
    new Date(lastRegistrationAt) > new Date(currentScheduleUpdatedAt)
  )
  // Real pair names are NOT present in the schedule.
  // registeredPairs uses "p1 / p2" combined format — split to individual names for matching
  const registeredPairs = tournamentConfig.registeredPairs as Array<{ category?: string; pairs: string[] }> | undefined
  const totalRealPairs = registeredPairs?.reduce((n, c) => n + c.pairs.length, 0) ?? 0
  const hasRealPairs = totalRealPairs >= 2
  const realPairNameSet = new Set(
    (registeredPairs ?? []).flatMap(c =>
      c.pairs.flatMap(p => p.split(' / ').map(n => n.trim()).filter(Boolean))
    )
  )
  const scheduleHasRealNames = hasRealPairs && !!(
    schedule?.matches.some(m => {
      const p1 = (m.pair1 ?? '').trim()
      const p2 = (m.pair2 ?? '').trim()
      if (realPairNameSet.has(p1) || realPairNameSet.has(p2)) return true
      return [...realPairNameSet].some(name => name.length > 2 && (m.matchLabel ?? '').includes(name))
    })
  )
  const hasGenericNames = hasRealPairs && !!schedule && !scheduleHasRealNames

  const scheduleOutOfSync = configChanged || registrationsChanged || hasGenericNames

  const outOfSyncReason = hasGenericNames
    ? `El horario tiene nombres genéricos pero hay ${totalRealPairs} parejas confirmadas. Actualízalo para asignarlas a los grupos.`
    : registrationsChanged
    ? 'Hay nuevas parejas confirmadas desde la última generación del horario.'
    : 'La configuración del torneo ha cambiado desde que se generó este horario.'

  // freshContext=true → don't include chat history (avoids context overflow on regenerate)
  async function sendMessage(text: string, freshContext = false) {
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setIsGenerating(true)
    setSaveError(null)

    const history = freshContext
      ? []
      : newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))

    const result = await chatWithScheduleAgent({
      tournamentId,
      userMessage: text,
      conversationHistory: history,
      tournamentConfig,
      currentSchedule: schedule ?? undefined,
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
      const label = newSchedule ? 'Generado (AI)' : 'Auto-guardado'
      const result2 = await saveSchedule({
        tournamentId,
        scheduleData: scheduleToSave as unknown as Record<string, unknown>,
        messages: updatedMessages as unknown as Record<string, unknown>[],
        versionLabel: label,
      })
      if ('data' in result2 && newSchedule) {
        setVersion(result2.data.version)
        const savedAt = new Date().toISOString()
        setCurrentScheduleUpdatedAt(savedAt)
        setVersionHistory(prev => [
          ...prev,
          { version: result2.data.version, savedAt, label, schedule: newSchedule },
        ].slice(-25))
      }
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
      versionLabel: 'Guardado manual',
    })
    if ('error' in result) {
      setSaveError(result.error)
    } else {
      const savedAt = new Date().toISOString()
      setCurrentScheduleUpdatedAt(savedAt)
      setVersion(result.data.version)
      setVersionHistory(prev => [
        ...prev,
        { version: result.data.version, savedAt, label: 'Guardado manual', schedule },
      ].slice(-25))
    }
    setIsSaving(false)
  }

  async function handlePublish() {
    if (!schedule) return
    await handleSave()
    const result = await publishSchedule(tournamentId)
    if (!('error' in result)) setIsPublished(true)
  }

  return (
    <>
    <div
      className="bg-background"
      style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}
    >
      {/* ── Left column: chat ─────────────────────────────────────── */}
      <div
        className="border-r border-border overflow-hidden shrink-0"
        style={{ width: chatWidth, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <h1 className="text-[18px] font-extrabold text-foreground tracking-[-0.4px]">Horario</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">{tournamentName}</p>
        </div>

        {/* Body */}
        {!hasHistory ? (
          <div className="overflow-y-auto flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-surface)] flex items-center justify-center">
              <Calendar className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-foreground">Sin horario generado</p>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-[240px]">
                {isAssignment
                  ? 'El agente asignará las parejas inscritas a los grupos y generará el horario completo con sus nombres.'
                  : 'El agente generará el horario óptimo basándose en la configuración del torneo.'}
              </p>
            </div>
            <button
              onClick={() => sendMessage(
                isAssignment
                  ? 'Asigna las parejas inscritas a los grupos y genera el horario completo con sus nombres reales.'
                  : 'Genera el horario óptimo para este torneo.',
                true
              )}
              disabled={isGenerating}
              className="px-5 py-2.5 bg-accent text-white text-[13px] font-semibold rounded-[8px] hover:bg-accent/90 disabled:opacity-50 transition-opacity"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generando...
                </span>
              ) : isAssignment ? 'Generar horario con parejas reales' : 'Generar horario'}
            </button>
          </div>
        ) : (
          <ScheduleChat messages={messages} isGenerating={isGenerating} onSend={sendMessage} />
        )}
      </div>

      {/* ── Drag handle ───────────────────────────────────────────── */}
      <div
        className="group relative flex items-center justify-center shrink-0 cursor-col-resize"
        style={{ width: 8 }}
        onMouseDown={e => {
          dragging.current = true
          dragStartX.current = e.clientX
          dragStartW.current = chatWidth
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
        }}
      >
        <div className="w-px h-full bg-border group-hover:bg-accent/40 transition-colors" />
      </div>

      {/* ── Right column: calendar ─────────────────────────────────── */}
      <div
        className="overflow-hidden flex-1"
        style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minWidth: 0 }}
      >
        {/* Actions bar */}
        <div>
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--accent-surface)] text-accent border border-accent/20">
                {mode}
              </span>
              {(versionHistory.length > 0 || schedule) && (
                <div className="relative" ref={historyRef}>
                  <button
                    onClick={() => setShowHistory(s => !s)}
                    disabled={versionHistory.length === 0}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-[5px] hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-default"
                  >
                    <Clock className="w-3 h-3" />
                    {versionHistory.length > 0
                      ? `${versionHistory.length} ${versionHistory.length === 1 ? 'versión' : 'versiones'} guardadas`
                      : 'Sin versiones guardadas'}
                  </button>
                  {showHistory && versionHistory.length > 0 && (
                    <div className="absolute left-0 top-7 bg-popover border border-border rounded-[10px] shadow-lg z-50 py-1 min-w-[220px] max-h-[320px] overflow-y-auto">
                      {[...versionHistory].reverse().map((v, ri) => {
                        const idx = versionHistory.length - 1 - ri
                        const isActive = previewIndex === idx || (idx === versionHistory.length - 1 && previewIndex === null)
                        return (
                          <button
                            key={idx}
                            onClick={() => { setPreviewIndex(idx === versionHistory.length - 1 ? null : idx); setShowHistory(false) }}
                            className={cn(
                              'w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-muted transition-colors',
                              isActive && 'text-accent'
                            )}
                          >
                            <span className="text-muted-foreground flex-1 truncate">{v.label}</span>
                            <span className="text-muted-foreground text-[10px] shrink-0">
                              {new Date(v.savedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {idx === versionHistory.length - 1 && (
                              <span className="text-[10px] bg-[var(--accent-surface)] text-accent px-1.5 py-0.5 rounded-full shrink-0">actual</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {isSaving && <span className="text-[11px] text-muted-foreground">Guardando...</span>}
              {saveError && <span className="text-[11px] text-[var(--error)]">{saveError}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFullscreen(true)}
                disabled={!displayedSchedule}
                title="Pantalla completa"
                className="flex items-center justify-center w-7 h-7 rounded-[6px] border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
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
          {scheduleOutOfSync && (
            <div className="px-5 py-2.5 bg-[var(--warning-surface)] border-b border-[var(--warning)]/30 flex items-center justify-between gap-3">
              <p className="text-[12px] text-[var(--warning)] font-medium">
                ⚠️ {outOfSyncReason}
              </p>
              <button
                onClick={() => sendMessage(
                  hasRealPairs
                    ? 'Regenera el horario completo. IMPORTANTE: usa los nombres reales SOLO para las categorías que tienen parejas en registeredPairs. Para las categorías sin parejas inscritas usa nombres genéricos (P1, P2…). No copies ni reutilices nombres de horarios anteriores para categorías sin inscripciones confirmadas.'
                    : 'Regenera el horario completo con la configuración actualizada del torneo.',
                  true
                )}
                disabled={isGenerating}
                className="shrink-0 text-[11px] font-semibold text-[var(--warning)] border border-[var(--warning)]/40 px-2.5 py-1 rounded-[6px] hover:bg-[var(--warning)]/10 transition-colors disabled:opacity-50"
              >
                {hasRealPairs ? 'Actualizar con parejas reales' : 'Regenerar ahora'}
              </button>
            </div>
          )}
        </div>

        {/* Calendar content */}
        <div className="overflow-y-auto">
          {previewIndex !== null && (
            <div className="mx-5 mt-4 px-3.5 py-2 bg-muted border border-border rounded-[8px] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] text-foreground">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>
                  Viendo <strong>v{versionHistory[previewIndex]?.version}</strong>
                  {' — '}
                  {versionHistory[previewIndex]?.label}
                  {' · '}
                  {new Date(versionHistory[previewIndex]?.savedAt ?? '').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleRestore(previewIndex)}
                  className="text-[11px] font-semibold text-accent hover:underline"
                >
                  Restaurar
                </button>
                <button
                  onClick={() => setPreviewIndex(null)}
                  className="text-[12px] text-muted-foreground hover:text-foreground leading-none"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          <div className="p-5">
            {displayedSchedule ? (
              <div className="bg-card border border-border rounded-[10px] overflow-hidden">
                <ScheduleCalendar schedule={displayedSchedule} />
              </div>
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
    </div>

    {/* ── Fullscreen overlay ─────────────────────────────────────── */}
    {fullscreen && displayedSchedule && (
      <div
        className="fixed inset-0 z-50 bg-background flex flex-col"
        style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}
      >
        <div className="px-6 py-3 border-b border-border flex items-center justify-between gap-4 bg-background">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--accent-surface)] text-accent border border-accent/20">
              {mode}
            </span>
            <span className="text-[13px] font-semibold text-foreground">{tournamentName}</span>
          </div>
          <button
            onClick={() => setFullscreen(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground border border-border rounded-[7px] hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cerrar
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <div className="bg-card border border-border rounded-[10px] overflow-hidden">
            <ScheduleCalendar schedule={displayedSchedule} />
          </div>
        </div>
      </div>
    )}
    </>
  )
}

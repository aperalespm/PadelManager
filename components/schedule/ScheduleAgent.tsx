'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, Clock, Send, Maximize2, X, ChevronDown } from 'lucide-react'
import { chatWithScheduleAgent, saveSchedule, publishSchedule, pollTournamentChanges } from '@/lib/actions/schedule-agent'
import type { VersionSnapshot } from '@/lib/actions/schedule-agent'
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
  // Tracks the last time the AI successfully generated a schedule in this session.
  // Used to dismiss the out-of-sync banner: after a successful generation, any
  // registrations/config changes must be NEWER than this timestamp to re-trigger.
  const [scheduleGeneratedAt, setScheduleGeneratedAt] = useState<string | null>(scheduleUpdatedAt ?? null)
  // Live timestamps polled every 30 s to detect online registrations / config changes
  const [liveLastRegistrationAt, setLiveLastRegistrationAt] = useState<string | null>(lastRegistrationAt ?? null)
  const [liveTournamentUpdatedAt, setLiveTournamentUpdatedAt] = useState<string | null>(tournamentUpdatedAt ?? null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showRequests, setShowRequests] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const historyRef = useRef<HTMLDivElement>(null)
  const requestsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Poll every 30 s for external changes (online registrations, config saves)
  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await pollTournamentChanges(tournamentId)
      if (result.lastRegistrationAt) setLiveLastRegistrationAt(result.lastRegistrationAt)
      if (result.tournamentUpdatedAt) setLiveTournamentUpdatedAt(result.tournamentUpdatedAt)
    }, 30_000)
    return () => clearInterval(interval)
  }, [tournamentId])

  useEffect(() => {
    if (!autoRegenerate) return
    const msg = isAssignment
      ? 'Regenera el horario completo usando las parejas inscritas actuales, respetando los ajustes de sesiones anteriores si los hay.'
      : 'Regenera el horario completo con la configuración actualizada del torneo, respetando los ajustes de sesiones anteriores si los hay.'
    sendMessage(msg, true, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) setShowHistory(false)
      if (requestsRef.current && !requestsRef.current.contains(e.target as Node)) setShowRequests(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const displayedSchedule = previewIndex !== null
    ? (versionHistory[previewIndex]?.schedule ?? null)
    : schedule

  const tournamentStatus = (tournamentConfig.tournamentStatus as string) ?? 'draft'
  const mode = tournamentStatus === 'active' ? 'En vivo'
    : tournamentStatus === 'open' ? 'Asignación'
    : 'Planificación'
  const isAssignment = tournamentStatus === 'open' || tournamentStatus === 'active'

  // ── Out-of-sync detection ───────────────────────────────────────────────────
  // All comparisons use scheduleGeneratedAt (set to now after every successful
  // AI generation) so the banner dismisses reliably after clicking "Actualizar".
  const registeredPairs = tournamentConfig.registeredPairs as Array<{ category?: string; pairs: string[] }> | undefined
  const totalRealPairs = registeredPairs?.reduce((n, c) => n + c.pairs.length, 0) ?? 0
  const hasRealPairs = totalRealPairs >= 2
  const realPairNameSet = new Set(
    (registeredPairs ?? []).flatMap(c =>
      c.pairs.flatMap(p => p.split(' / ').map(n => n.trim()).filter(Boolean))
    )
  )

  // configChanged / registrationsChanged: compare against scheduleGeneratedAt,
  // not currentScheduleUpdatedAt, so manual Guardar clicks don't reset the banner.
  const configChanged = !!(
    schedule && scheduleGeneratedAt && liveTournamentUpdatedAt &&
    new Date(liveTournamentUpdatedAt) > new Date(scheduleGeneratedAt)
  )
  const registrationsChanged = !!(
    schedule && scheduleGeneratedAt && liveLastRegistrationAt &&
    new Date(liveLastRegistrationAt) > new Date(scheduleGeneratedAt)
  )

  // hasGenericNames: schedule was generated in planning mode (no real pairs assigned yet)
  const scheduleHasRealNames = hasRealPairs && !!(
    schedule?.matches.some(m => {
      const p1 = (m.pair1 ?? '').trim()
      const p2 = (m.pair2 ?? '').trim()
      if (realPairNameSet.has(p1) || realPairNameSet.has(p2)) return true
      return [...realPairNameSet].some(name => name.length > 2 && (m.matchLabel ?? '').includes(name))
    })
  )
  const hasGenericNames = hasRealPairs && !!schedule && !scheduleHasRealNames && !scheduleGeneratedAt

  const scheduleOutOfSync = configChanged || registrationsChanged || hasGenericNames
  const outOfSyncReason = 'Hay cambios pendientes de implementar en el horario.'

  // ── Previous user instructions (for history dropdown) ──────────────────────
  const userRequests = messages.filter(m => m.role === 'user').map(m => m.content)

  // ── Core send ───────────────────────────────────────────────────────────────
  // freshContext: omit conversation history (avoids context overflow on regenerate)
  // resetSchedule: omit current schedule so AI can't carry over invented names
  async function sendMessage(text: string, freshContext = false, resetSchedule = false) {
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
      currentSchedule: resetSchedule ? undefined : (schedule ?? undefined),
      resetSchedule,
    })

    if ('error' in result) {
      const errMsg: ChatMessage = { role: 'assistant', content: result.error, timestamp: new Date().toISOString() }
      setMessages(prev => [...prev, errMsg])
      setIsGenerating(false)
      return
    }

    const { message, schedule: newSchedule } = result.data
    const assistantMsg: ChatMessage = {
      role: 'assistant', content: message,
      schedule: newSchedule ?? undefined, timestamp: new Date().toISOString(),
    }
    const updatedMessages = [...newMessages, assistantMsg]
    setMessages(updatedMessages)
    if (newSchedule) {
      setSchedule(newSchedule)
      setToast('Horario actualizado')
    }
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
        const savedAt = new Date().toISOString()
        setCurrentScheduleUpdatedAt(savedAt)
        // Mark the schedule as freshly generated so the out-of-sync banner dismisses.
        // Only set when the AI returned a new schedule (not on manual saves).
        setScheduleGeneratedAt(savedAt)
        setVersion(result2.data.version)
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = inputText.trim()
    if (!text || isGenerating) return
    setInputText('')
    // If registrations changed since last schedule generation, reset the schedule
    // context so the AI can't copy stale names from the old saved schedule.
    sendMessage(text, registrationsChanged, registrationsChanged)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const calendarContent = (
    <>
      {previewIndex !== null && (
        <div className="mx-5 mt-4 px-3.5 py-2 bg-muted border border-border rounded-[8px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[12px] text-foreground">
            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>
              Viendo <strong>v{versionHistory[previewIndex]?.version}</strong>
              {' — '}{versionHistory[previewIndex]?.label}
              {' · '}{new Date(versionHistory[previewIndex]?.savedAt ?? '').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => handleRestore(previewIndex)} className="text-[11px] font-semibold text-accent hover:underline">
              Restaurar
            </button>
            <button onClick={() => setPreviewIndex(null)} className="text-[12px] text-muted-foreground hover:text-foreground">✕</button>
          </div>
        </div>
      )}

      <div className="p-5 pb-24">
        {displayedSchedule ? (
          <div className="bg-card border border-border rounded-[10px] overflow-hidden">
            <ScheduleCalendar schedule={displayedSchedule} />
          </div>
        ) : (
          <div className="flex items-center justify-center py-32 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--accent-surface)] flex items-center justify-center">
                <Calendar className="w-7 h-7 text-accent" />
              </div>
              <div>
                <p className="text-[16px] font-semibold text-foreground">Sin horario generado</p>
                <p className="text-[13px] text-muted-foreground mt-1.5 max-w-[280px]">
                  {isAssignment
                    ? 'Escribe una instrucción abajo o pulsa el botón para generar el horario con las parejas inscritas.'
                    : 'Escribe una instrucción abajo o pulsa el botón para generar el horario óptimo.'}
                </p>
              </div>
              <button
                onClick={() => sendMessage(
                  isAssignment
                    ? 'Asigna las parejas inscritas a los grupos y genera el horario completo con sus nombres reales.'
                    : 'Genera el horario óptimo para este torneo.',
                  true,
                  isAssignment  // resetSchedule: don't carry over invented names
                )}
                disabled={isGenerating}
                className="px-5 py-2.5 bg-accent text-white text-[13px] font-semibold rounded-[8px] hover:bg-accent/90 disabled:opacity-50 transition-opacity flex items-center gap-2"
              >
                {isGenerating
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generando...</>
                  : isAssignment ? 'Generar horario con parejas reales' : 'Generar horario'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )

  return (
    <>
    <div className="bg-background flex flex-col" style={{ height: '100vh' }}>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border">
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--accent-surface)] text-accent border border-accent/20">
              {mode}
            </span>

            {/* Version history */}
            {(versionHistory.length > 0 || schedule) && (
              <div className="relative" ref={historyRef}>
                <button
                  onClick={() => setShowHistory(s => !s)}
                  disabled={versionHistory.length === 0}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-[5px] hover:bg-muted transition-colors disabled:opacity-40"
                >
                  <Clock className="w-3 h-3" />
                  {versionHistory.length > 0
                    ? `${versionHistory.length} ${versionHistory.length === 1 ? 'versión' : 'versiones'} guardadas`
                    : 'Sin versiones'}
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
                          className={cn('w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-muted transition-colors', isActive && 'text-accent')}
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

            {/* Previous requests */}
            {userRequests.length > 0 && (
              <div className="relative" ref={requestsRef}>
                <button
                  onClick={() => setShowRequests(s => !s)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-[5px] hover:bg-muted transition-colors"
                >
                  {userRequests.length} {userRequests.length === 1 ? 'ajuste' : 'ajustes'}
                  <ChevronDown className={cn('w-3 h-3 transition-transform', showRequests && 'rotate-180')} />
                </button>
                {showRequests && (
                  <div className="absolute left-0 top-7 bg-popover border border-border rounded-[10px] shadow-lg z-50 py-1 min-w-[260px] max-h-[280px] overflow-y-auto">
                    {userRequests.map((req, i) => (
                      <div key={i} className="px-3 py-2 text-[12px] text-foreground/80 border-b border-border/40 last:border-0">
                        <span className="text-[10px] text-muted-foreground mr-1.5">#{i + 1}</span>
                        {req}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(isSaving) && <span className="text-[11px] text-muted-foreground">Guardando...</span>}
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

        {/* Out-of-sync banner */}
        {scheduleOutOfSync && (
          <div className="px-5 py-2.5 bg-[var(--warning-surface)] border-t border-[var(--warning)]/30 flex items-center justify-between gap-3">
            <p className="text-[12px] text-[var(--warning)] font-medium">⚠️ {outOfSyncReason}</p>
            <button
              onClick={() => sendMessage(
                hasRealPairs
                  ? 'Regenera el horario completo. Usa nombres reales solo para las categorías con parejas inscritas. Para las demás usa P1, P2, P3…'
                  : 'Regenera el horario completo con la configuración actualizada del torneo.',
                true,
                true  // resetSchedule: don't carry over invented names
              )}
              disabled={isGenerating}
              className="shrink-0 text-[11px] font-semibold text-[var(--warning)] border border-[var(--warning)]/40 px-2.5 py-1 rounded-[6px] hover:bg-[var(--warning)]/10 transition-colors disabled:opacity-50"
            >
              Actualizar horario
            </button>
          </div>
        )}
      </div>

      {/* ── Calendar ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {calendarContent}
        {isGenerating && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 z-20">
            <span className="w-9 h-9 border-[3px] border-accent/20 border-t-accent rounded-full animate-spin" />
            <p className="text-[13px] font-medium text-muted-foreground">Generando horario…</p>
          </div>
        )}
      </div>

      {/* ── Bottom input bar ─────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-background px-5 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef as unknown as React.RefObject<HTMLInputElement>}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={isGenerating ? 'Generando horario…' : 'Pide un ajuste… (ej: "finales a las 20:00", "pausa de 15 min entre partidos")'}
            disabled={isGenerating}
            className="flex-1 text-[13px] bg-background border border-border rounded-[8px] px-3 py-2 outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isGenerating}
            className="shrink-0 flex items-center justify-center w-9 h-9 bg-accent text-white rounded-[8px] hover:bg-accent/90 disabled:opacity-40 transition-opacity"
          >
            {isGenerating
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>

    {/* ── Toast notification ───────────────────────────────────────── */}
    {toast && (
      <div className="fixed bottom-20 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-[var(--success)] text-white text-[13px] font-semibold rounded-[10px] shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
        <span className="w-4 h-4 flex items-center justify-center rounded-full bg-white/20 text-[10px]">✓</span>
        {toast}
      </div>
    )}

    {/* ── Fullscreen overlay ─────────────────────────────────────── */}
    {fullscreen && displayedSchedule && (
      <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
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

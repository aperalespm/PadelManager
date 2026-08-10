'use client'

import { useState, useTransition } from 'react'
import { sendEmailToPlayers } from '@/lib/actions/emails'

interface Props {
  tournamentId: string
  tournamentName: string
  categoryOptions: string[]
  recipientCounts: Record<string, number>
}

const FILTER_LABELS: Record<string, string> = {
  all: 'Todos los inscritos',
  confirmed: 'Solo confirmados',
  pending: 'Pendientes de confirmación',
  waitlist: 'Lista de espera',
}

export function EmailComposer({ tournamentId, tournamentName, categoryOptions, recipientCounts }: Props) {
  const [filter, setFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sent, setSent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const estimatedCount = categoryFilter
    ? null
    : recipientCounts[filter] ?? 0

  function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setError('El asunto y el cuerpo son obligatorios')
      return
    }
    setError(null)
    setSent(null)
    startTransition(async () => {
      const res = await sendEmailToPlayers({
        tournamentId,
        subject,
        body,
        filter,
        categoryFilter: categoryFilter || undefined,
      })
      if ('error' in res) {
        setError(res.error)
      } else {
        setSent(res.data.sent)
        setSubject('')
        setBody('')
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-bold text-foreground tracking-tight">Enviar email</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Envía un mensaje personalizado a los jugadores inscritos en <strong>{tournamentName}</strong>
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Destinatarios</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-muted-foreground">Estado</label>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {Object.entries(FILTER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {categoryOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-muted-foreground">Categoría</label>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <option value="">Todas las categorías</option>
                {categoryOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {estimatedCount !== null && (
          <p className="text-[13px] text-muted-foreground">
            {estimatedCount === 0
              ? 'No hay destinatarios con email para este filtro'
              : <>Se enviará a <strong className="text-foreground">{estimatedCount}</strong> jugador{estimatedCount !== 1 ? 'es' : ''}</>
            }
          </p>
        )}
      </div>

      {/* Compose */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Mensaje</p>

        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-muted-foreground">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Ej: Información importante sobre el torneo"
            className="px-3 py-2.5 rounded-lg border border-border bg-background text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-muted-foreground">Cuerpo del mensaje</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={`Hola a todos,\n\nOs escribimos para informaros sobre...\n\nUn saludo,\nEl equipo organizador`}
            rows={8}
            className="px-3 py-2.5 rounded-lg border border-border bg-background text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y min-h-[140px]"
          />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
            <p className="text-[11px] text-muted-foreground/60">Separa párrafos con una línea en blanco.</p>
            <p className="text-[11px] text-muted-foreground/60">
              Variables:{' '}
              <code className="bg-muted px-1 rounded text-[10px] text-foreground/70">{'{nombre}'}</code>{' '}
              <code className="bg-muted px-1 rounded text-[10px] text-foreground/70">{'{torneo}'}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-[13px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {sent !== null && (
        <div className="px-4 py-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-[13px] text-green-700 dark:text-green-400 font-medium">
          ✓ Email enviado a {sent} jugador{sent !== 1 ? 'es' : ''}
        </div>
      )}

      {/* Action */}
      <div className="flex justify-end">
        <button
          onClick={handleSend}
          disabled={isPending || !subject.trim() || !body.trim()}
          className="px-6 py-2.5 rounded-xl bg-accent text-accent-foreground text-[14px] font-semibold disabled:opacity-50 hover:bg-accent/90 transition-colors"
        >
          {isPending ? 'Enviando…' : 'Enviar email'}
        </button>
      </div>
    </div>
  )
}

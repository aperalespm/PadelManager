import { EmailLog as EmailLogType } from '@/lib/actions/emails'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  registration_received: { label: 'Inscripción recibida', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400' },
  registration_confirmed: { label: 'Plaza confirmada', color: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400' },
  registration_added: { label: 'Añadido por admin', color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400' },
  broadcast: { label: 'Difusión', color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-400' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  logs: EmailLogType[]
}

export function EmailLog({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-[13px]">
        No hay emails enviados todavía
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {logs.map(log => {
        const meta = TYPE_LABELS[log.type] ?? { label: log.type, color: 'text-muted-foreground bg-muted border-border' }
        return (
          <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
            {/* Date */}
            <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5 w-36">
              {formatDate(log.sentAt)}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                  {meta.label}
                </span>
                {log.type === 'broadcast' && (
                  <span className="text-[11px] text-muted-foreground">
                    {log.recipientCount} destinatario{log.recipientCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[13px] font-medium text-foreground truncate">{log.subject}</p>
              {log.toName && (
                <p className="text-[12px] text-muted-foreground truncate">
                  {log.toName}{log.toEmail ? ` · ${log.toEmail}` : ''}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

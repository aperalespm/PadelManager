'use client'

import { useEffect, useState, useTransition } from 'react'
import { addParticipantByAdmin } from '@/lib/actions/registrations'
import { cn } from '@/lib/utils'

interface Props {
  tournamentId: string
  registrationTypes: string[]
  categories: string[]
  onSuccess: () => void
  onClose: () => void
}

export function AddParticipantModal({ tournamentId, registrationTypes, categories, onSuccess, onClose }: Props) {
  const hasBothTypes = registrationTypes.includes('pair') && registrationTypes.includes('individual')
  const defaultType = registrationTypes.includes('pair') ? 'pair' : 'individual'

  const [regType, setRegType] = useState<'pair' | 'individual'>(defaultType as 'pair' | 'individual')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [partnerEmail, setPartnerEmail] = useState('')
  const [category, setCategory] = useState(categories[0] ?? '')
  const [status, setStatus] = useState<'confirmed' | 'pending'>('confirmed')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await addParticipantByAdmin({
        tournament_id: tournamentId,
        name,
        email: email || undefined,
        partner_name: regType === 'pair' ? (partnerName || undefined) : undefined,
        partner_email: regType === 'pair' ? (partnerEmail || undefined) : undefined,
        registration_type: regType,
        status,
        category: category || undefined,
      })
      if ('error' in result && result.error) {
        setError(result.error as string)
      } else {
        onSuccess()
      }
    })
  }

  const inputClass = 'border border-border rounded-[8px] text-[14px] bg-background px-3 py-2.5 w-full outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors'
  const segmentBase = 'px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer'
  const segmentActive = 'bg-accent text-accent-foreground'
  const segmentInactive = 'text-muted-foreground hover:text-foreground'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-background max-w-md w-full mx-4 rounded-xl p-6 shadow-xl border border-border"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-[18px] font-extrabold text-foreground mb-4 tracking-[-0.4px]">Añadir participante</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Registration type segmented control */}
          {hasBothTypes && (
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Tipo</label>
              <div className="flex gap-1 bg-muted rounded-[8px] p-0.5">
                <button
                  type="button"
                  onClick={() => setRegType('pair')}
                  className={cn(segmentBase, 'flex-1', regType === 'pair' ? segmentActive : segmentInactive)}
                >
                  Pareja
                </button>
                <button
                  type="button"
                  onClick={() => setRegType('individual')}
                  className={cn(segmentBase, 'flex-1', regType === 'individual' ? segmentActive : segmentInactive)}
                >
                  Individual
                </button>
              </div>
            </div>
          )}

          {/* Player 1 */}
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del jugador"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
              className={inputClass}
            />
          </div>

          {/* Partner fields */}
          {regType === 'pair' && (
            <>
              <div>
                <label className="block text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Nombre pareja</label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={e => setPartnerName(e.target.value)}
                  placeholder="Nombre de la pareja"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Email pareja</label>
                <input
                  type="email"
                  value={partnerEmail}
                  onChange={e => setPartnerEmail(e.target.value)}
                  placeholder="pareja@ejemplo.com"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* Category */}
          {categories.length > 0 && (
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Categoría <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">Seleccionar categoría...</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Estado</label>
            <div className="flex gap-1 bg-muted rounded-[8px] p-0.5">
              <button
                type="button"
                onClick={() => setStatus('confirmed')}
                className={cn(segmentBase, 'flex-1', status === 'confirmed' ? segmentActive : segmentInactive)}
              >
                Confirmado
              </button>
              <button
                type="button"
                onClick={() => setStatus('pending')}
                className={cn(segmentBase, 'flex-1', status === 'pending' ? segmentActive : segmentInactive)}
              >
                Pendiente
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-red-500 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border rounded-[8px] text-[14px] font-medium text-muted-foreground bg-background px-3 py-2.5 hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-accent text-accent-foreground rounded-[8px] text-[14px] font-semibold px-3 py-2.5 hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Añadiendo...' : 'Añadir participante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

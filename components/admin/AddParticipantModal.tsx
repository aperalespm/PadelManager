'use client'

import { useEffect, useState, useTransition } from 'react'
import { addParticipantByAdmin } from '@/lib/actions/registrations'
import { cn } from '@/lib/utils'

interface SystemFields {
  name: boolean; email: boolean; phone: boolean; level: boolean; conditions: boolean
  partner_name: boolean; partner_email: boolean; partner_phone: boolean; partner_level: boolean
}
interface CustomField {
  id: string; type: 'text' | 'number' | 'select' | 'checkbox'; label: string
  required: boolean; options: string[]; applies_to: 'all' | 'pair' | 'individual'
}
interface RegistrationConfig {
  registration_types: string[]
  system_fields: SystemFields
  custom_fields: CustomField[]
}

const DEFAULT_SF: SystemFields = {
  name: true, email: true, phone: true, level: false, conditions: false,
  partner_name: true, partner_email: true, partner_phone: false, partner_level: false,
}

interface Props {
  tournamentId: string
  registrationTypes: string[]
  categories: string[]
  registrationConfig?: RegistrationConfig | null
  onSuccess: () => void
  onClose: () => void
}

export function AddParticipantModal({ tournamentId, registrationTypes, categories, registrationConfig, onSuccess, onClose }: Props) {
  const hasBothTypes = registrationTypes.includes('pair') && registrationTypes.includes('individual')
  const defaultType = registrationTypes.includes('pair') ? 'pair' : 'individual'
  const sf: SystemFields = registrationConfig?.system_fields ?? DEFAULT_SF
  const customFields: CustomField[] = registrationConfig?.custom_fields ?? []

  const [regType, setRegType]   = useState<'pair' | 'individual'>(defaultType as 'pair' | 'individual')
  const [fields, setFields]     = useState<Record<string, string>>({})
  const [status, setStatus]     = useState<'confirmed' | 'pending'>('confirmed')
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isPair = regType === 'pair'

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const set = (key: string, value: string) => setFields(f => ({ ...f, [key]: value }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!fields.name?.trim()) { setError('El nombre es obligatorio'); return }
    if (categories.length > 0 && !fields.category) { setError('Selecciona una categoría'); return }

    startTransition(async () => {
      const result = await addParticipantByAdmin({
        tournament_id: tournamentId,
        name: fields.name ?? '',
        partner_name: isPair ? (fields.partner_name || undefined) : undefined,
        registration_type: regType,
        status,
        category: fields.category || undefined,
        form_data: fields,
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

  function FieldLabel({ label, required }: { label: string; required: boolean }) {
    return (
      <label className="block text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        {!required && <span className="text-muted-foreground font-normal normal-case ml-1">(opcional)</span>}
      </label>
    )
  }

  function SideToggle({ fieldKey, label }: { fieldKey: string; label: string }) {
    return (
      <div>
        <FieldLabel label={label} required />
        <div className="flex gap-1 bg-muted rounded-[8px] p-0.5">
          {(['Derecha', 'Reves'] as const).map(side => (
            <button key={side} type="button" onClick={() => set(fieldKey, side)}
              className={cn(segmentBase, 'flex-1', fields[fieldKey] === side ? segmentActive : segmentInactive)}>
              {side}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const visibleCustom = customFields.filter(cf =>
    cf.applies_to === 'all' || (isPair && cf.applies_to === 'pair') || (!isPair && cf.applies_to === 'individual')
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-background max-w-md w-full mx-4 rounded-xl shadow-xl border border-border max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-[18px] font-extrabold text-foreground tracking-[-0.4px]">Añadir participante</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-4 overflow-y-auto flex-1">
          {/* Registration type */}
          {hasBothTypes && (
            <div>
              <FieldLabel label="Tipo" required />
              <div className="flex gap-1 bg-muted rounded-[8px] p-0.5">
                <button type="button" onClick={() => setRegType('pair')}
                  className={cn(segmentBase, 'flex-1', isPair ? segmentActive : segmentInactive)}>
                  Pareja
                </button>
                <button type="button" onClick={() => setRegType('individual')}
                  className={cn(segmentBase, 'flex-1', !isPair ? segmentActive : segmentInactive)}>
                  Individual
                </button>
              </div>
            </div>
          )}

          {/* ── Jugador 1 ── */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Jugador 1</p>

            <div>
              <FieldLabel label="Nombre" required />
              <input type="text" required value={fields.name ?? ''} onChange={e => set('name', e.target.value)}
                placeholder="Nombre del jugador" className={inputClass} />
            </div>

            {sf.email && (
              <div>
                <FieldLabel label="Email" required={sf.email} />
                <input type="email" value={fields.email ?? ''} onChange={e => set('email', e.target.value)}
                  placeholder="email@ejemplo.com" className={inputClass} />
              </div>
            )}

            {sf.phone && (
              <div>
                <FieldLabel label="Teléfono" required={sf.phone} />
                <input type="tel" value={fields.phone ?? ''} onChange={e => set('phone', e.target.value)}
                  placeholder="+34 600 000 000" className={inputClass} />
              </div>
            )}

            <div>
              <FieldLabel label="Nivel" required={sf.level} />
              <input type="number" min="1" max="10" value={fields.level ?? ''} onChange={e => set('level', e.target.value)}
                placeholder="1-10" className="border border-border rounded-[8px] text-[14px] bg-background px-3 py-2.5 w-24 outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors" />
            </div>

            <SideToggle fieldKey="side" label="Lado en pista" />
          </div>

          {/* ── Jugador 2 ── */}
          {isPair && (
            <div className="rounded-xl border border-accent/25 bg-accent/5 p-4 flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent">Jugador 2 (pareja)</p>

              <div>
                <FieldLabel label="Nombre pareja" required={sf.partner_name} />
                <input type="text" value={fields.partner_name ?? ''} onChange={e => set('partner_name', e.target.value)}
                  placeholder="Nombre de la pareja" className={inputClass} />
              </div>

              {sf.partner_email && (
                <div>
                  <FieldLabel label="Email pareja" required={sf.partner_email} />
                  <input type="email" value={fields.partner_email ?? ''} onChange={e => set('partner_email', e.target.value)}
                    placeholder="pareja@ejemplo.com" className={inputClass} />
                </div>
              )}

              {sf.partner_phone && (
                <div>
                  <FieldLabel label="Teléfono pareja" required={sf.partner_phone} />
                  <input type="tel" value={fields.partner_phone ?? ''} onChange={e => set('partner_phone', e.target.value)}
                    placeholder="+34 600 000 000" className={inputClass} />
                </div>
              )}

              <div>
                <FieldLabel label="Nivel pareja" required={sf.partner_level} />
                <input type="number" min="1" max="10" value={fields.partner_level ?? ''} onChange={e => set('partner_level', e.target.value)}
                  placeholder="1-10" className="border border-border rounded-[8px] text-[14px] bg-background px-3 py-2.5 w-24 outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors" />
              </div>

              <SideToggle fieldKey="partner_side" label="Lado en pista pareja" />
            </div>
          )}

          {/* Category */}
          {categories.length > 0 && (
            <div>
              <FieldLabel label="Categoría" required />
              <select value={fields.category ?? ''} onChange={e => set('category', e.target.value)} required className={inputClass}>
                <option value="">Seleccionar categoría...</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Custom fields */}
          {visibleCustom.map(cf => (
            <div key={cf.id}>
              <FieldLabel label={cf.label} required={cf.required} />
              {cf.type === 'text' && (
                <input className={inputClass} value={fields[cf.id] ?? ''} onChange={e => set(cf.id, e.target.value)} />
              )}
              {cf.type === 'number' && (
                <input type="number" className="border border-border rounded-[8px] text-[14px] bg-background px-3 py-2.5 w-28 outline-none focus:ring-2 focus:ring-accent/40" value={fields[cf.id] ?? ''} onChange={e => set(cf.id, e.target.value)} />
              )}
              {cf.type === 'select' && (
                <select className={inputClass} value={fields[cf.id] ?? ''} onChange={e => set(cf.id, e.target.value)}>
                  <option value="">Selecciona…</option>
                  {cf.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {cf.type === 'checkbox' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fields[cf.id] === 'true'}
                    onChange={e => set(cf.id, e.target.checked ? 'true' : 'false')}
                    className="w-4 h-4 rounded accent-accent" />
                  <span className="text-[14px] text-foreground">{cf.label}</span>
                </label>
              )}
            </div>
          ))}

          {/* Status */}
          <div>
            <FieldLabel label="Estado" required />
            <div className="flex gap-1 bg-muted rounded-[8px] p-0.5">
              <button type="button" onClick={() => setStatus('confirmed')}
                className={cn(segmentBase, 'flex-1', status === 'confirmed' ? segmentActive : segmentInactive)}>
                Confirmado
              </button>
              <button type="button" onClick={() => setStatus('pending')}
                className={cn(segmentBase, 'flex-1', status === 'pending' ? segmentActive : segmentInactive)}>
                Pendiente
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-red-500 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1 pb-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border rounded-[8px] text-[14px] font-medium text-muted-foreground bg-background px-3 py-2.5 hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 bg-accent text-accent-foreground rounded-[8px] text-[14px] font-semibold px-3 py-2.5 hover:bg-accent/90 transition-colors disabled:opacity-50">
              {isPending ? 'Añadiendo...' : 'Añadir participante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

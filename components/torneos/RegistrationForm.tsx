'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerForTournament } from '@/lib/actions/registrations'
import { cn } from '@/lib/utils'

// ── Types (mirrors admin config) ─────────────────────────────────────────────

type FieldAppliesTo = 'all' | 'pair' | 'individual'
type FieldType = 'text' | 'number' | 'select' | 'checkbox'

interface SystemFields {
  name: boolean; email: boolean; phone: boolean; level: boolean; conditions: boolean
  partner_name: boolean; partner_email: boolean; partner_phone: boolean; partner_level: boolean
}
interface CustomField {
  id: string; type: FieldType; label: string; required: boolean; options: string[]; applies_to: FieldAppliesTo
}
interface RegistrationConfig {
  registration_types: string[]
  system_fields: SystemFields
  custom_fields: CustomField[]
}

const DEFAULT_CONFIG: RegistrationConfig = {
  registration_types: ['pair'],
  system_fields: { name: true, email: true, phone: true, level: false, conditions: true, partner_name: true, partner_email: true, partner_phone: false, partner_level: false },
  custom_fields: [],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FieldLabel({ children, required, optional }: { children: React.ReactNode; required: boolean; optional?: boolean }) {
  return (
    <label className="block text-[13px] font-medium text-foreground mb-1.5">
      {children}
      {required ? <span className="text-[var(--error)] ml-0.5">*</span> : <span className="text-muted-foreground font-normal ml-1 text-[12px]">(opcional)</span>}
    </label>
  )
}

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-[8px] text-[14px] bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors'
const numberCls = 'w-24 px-3 py-2.5 border border-border rounded-[8px] text-[14px] bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors'

// ── Main Component ────────────────────────────────────────────────────────────

interface RegistrationFormProps {
  tournament: Record<string, unknown>
  userId: string
}

export function RegistrationForm({ tournament: t }: RegistrationFormProps) {
  const router = useRouter()

  const rawConfig = t.registration_config as RegistrationConfig | null | undefined
  const config: RegistrationConfig = (rawConfig && Array.isArray(rawConfig.custom_fields))
    ? { ...DEFAULT_CONFIG, ...rawConfig, system_fields: { ...DEFAULT_CONFIG.system_fields, ...(rawConfig.system_fields ?? {}) } }
    : DEFAULT_CONFIG

  // Build selectable category options from venue_details (same expansion as horario page)
  const vd = (t.venue_details as Record<string, unknown>) ?? {}
  const rawCats = (vd.categories as Array<{ name: string; genders?: string[] }>) ?? []
  const categoryOptions: string[] = rawCats.flatMap(c => {
    const genders = c.genders ?? []
    if (genders.length === 0) return [c.name]
    return genders.map(g => `${c.name} ${g === 'M' ? 'Masculino' : g === 'F' ? 'Femenino' : 'Mixto'}`)
  })

  const hasPair       = config.registration_types.includes('pair')
  const hasIndividual = config.registration_types.includes('individual')
  const bothEnabled   = hasPair && hasIndividual

  const [regType, setRegType] = useState<'pair' | 'individual'>(hasPair ? 'pair' : 'individual')
  const isPair = regType === 'pair'

  // Field values
  const [fields, setFields]   = useState<Record<string, string>>({})
  const [checks, setChecks]   = useState<Record<string, boolean>>({})
  const [conditions, setConditions] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

  const sf = config.system_fields
  const confirmed  = (t.confirmed_count as number) ?? 0
  const maxPlayers = (t.max_players as number) ?? 0
  const isFull     = confirmed >= maxPlayers

  const setField = (key: string, value: string) => setFields(f => ({ ...f, [key]: value }))

  function validate(): string | null {
    if (categoryOptions.length > 0 && !fields.category) return 'Selecciona una categoría'
    if (sf.name      && !fields.name?.trim())         return 'El nombre es obligatorio'
    if (sf.email     && !fields.email?.trim())        return 'El email es obligatorio'
    if (sf.phone     && !fields.phone?.trim())        return 'El teléfono es obligatorio'
    if (sf.level     && !fields.level?.trim())        return 'El nivel es obligatorio'
    if (!fields.side) return 'Indica el lado en pista del jugador 1'
    if (isPair) {
      if (sf.partner_name  && !fields.partner_name?.trim())  return 'El nombre de tu pareja es obligatorio'
      if (sf.partner_email && !fields.partner_email?.trim()) return 'El email de tu pareja es obligatorio'
      if (sf.partner_phone && !fields.partner_phone?.trim()) return 'El teléfono de tu pareja es obligatorio'
      if (sf.partner_level && !fields.partner_level?.trim()) return 'El nivel de tu pareja es obligatorio'
      if (!fields.partner_side) return 'Indica el lado en pista del jugador 2'
    }
    for (const cf of config.custom_fields) {
      const active = cf.applies_to === 'all' || (isPair && cf.applies_to === 'pair') || (!isPair && cf.applies_to === 'individual')
      if (!active) continue
      if (cf.required && cf.type !== 'checkbox' && !fields[cf.id]?.trim()) return `"${cf.label}" es obligatorio`
      if (cf.required && cf.type === 'checkbox' && !checks[cf.id])          return `Debes marcar "${cf.label}"`
    }
    if (sf.conditions && !conditions) return 'Debes aceptar los términos y condiciones'
    return null
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true)
    setError('')
    try {
      const form_data = {
        registration_type: regType,
        ...fields,
        ...Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, v ? 'true' : 'false'])),
        conditions: conditions ? 'true' : 'false',
      }
      const result = await registerForTournament({
        tournament_id: t.id as string,
        player2_name: isPair ? (fields.partner_name ?? undefined) : undefined,
        form_data,
      })
      if ('error' in result) { setError(result.error as string); return }
      setSuccess(true)
      router.push('/mi-torneo')
    } catch {
      setError('Error al procesar la inscripción')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold text-foreground">¡Inscripción enviada!</h2>
        <p className="text-muted-foreground text-sm">El organizador revisará tu inscripción pronto.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {isFull && (
        <div className="bg-[var(--warning-surface,#fff7ed)] border border-[var(--warning)]/40 rounded-[8px] px-4 py-3 text-[13px] text-[var(--warning)]">
          ⚠️ Este torneo está completo. Puedes apuntarte a la lista de espera.
        </div>
      )}

      {/* Type selector */}
      {bothEnabled && (
        <div>
          <FieldLabel required>¿Cómo te inscribes?</FieldLabel>
          <div className="flex rounded-[8px] overflow-hidden border border-border text-[13px] font-semibold">
            <button type="button" onClick={() => setRegType('pair')}
              className={cn('flex-1 py-2.5 transition-colors', isPair ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground')}>
              En pareja
            </button>
            <button type="button" onClick={() => setRegType('individual')}
              className={cn('flex-1 py-2.5 border-l border-border transition-colors', !isPair ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground')}>
              Individual
            </button>
          </div>
        </div>
      )}

      {/* ── Categoría ────────────────────────────────────────── */}
      {categoryOptions.length > 0 && (
        <div>
          <FieldLabel required>Categoría</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setField('category', cat)}
                className={cn(
                  'px-4 py-2 rounded-[8px] border text-[13px] font-medium transition-colors',
                  fields.category === cat
                    ? 'bg-accent text-white border-accent'
                    : 'border-border text-foreground hover:bg-muted'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Jugador 1 ─────────────────────────────────────────── */}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Jugador 1 — tus datos</p>
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel required={sf.name}>Nombre completo</FieldLabel>
            <input className={inputCls} value={fields.name ?? ''} onChange={e => setField('name', e.target.value)} placeholder="Tu nombre y apellido" />
          </div>
          <div>
            <FieldLabel required={sf.email}>Email</FieldLabel>
            <input type="email" className={inputCls} value={fields.email ?? ''} onChange={e => setField('email', e.target.value)} placeholder="tu@email.com" />
          </div>
          <div>
            <FieldLabel required={sf.phone}>Teléfono</FieldLabel>
            <input type="tel" className={inputCls} value={fields.phone ?? ''} onChange={e => setField('phone', e.target.value)} placeholder="+34 600 000 000" />
          </div>
          <div>
            <FieldLabel required={sf.level}>Nivel</FieldLabel>
            <input type="number" className={numberCls} value={fields.level ?? ''} onChange={e => setField('level', e.target.value)} placeholder="1-10" min="1" max="10" />
          </div>
          <div>
            <FieldLabel required>Lado en pista</FieldLabel>
            <div className="flex rounded-[8px] border border-border overflow-hidden w-fit">
              {(['Derecha', 'Reves'] as const).map(side => (
                <button key={side} type="button"
                  onClick={() => setField('side', side)}
                  className={cn('px-5 py-2.5 text-[13px] font-semibold transition-colors',
                    fields.side === side ? 'bg-accent text-white' : 'bg-background text-muted-foreground hover:text-foreground'
                  )}
                >{side}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Jugador 2 ─────────────────────────────────────────── */}
      {isPair && (
        <section className="border-t border-border pt-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent mb-3">Jugador 2 — datos de tu pareja</p>
          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel required={sf.partner_name}>Nombre completo</FieldLabel>
              <input className={cn(inputCls, 'border-accent/30 focus:border-accent')} value={fields.partner_name ?? ''} onChange={e => setField('partner_name', e.target.value)} placeholder="Nombre y apellido de tu pareja" />
            </div>
            <div>
              <FieldLabel required={sf.partner_email}>Email</FieldLabel>
              <input type="email" className={cn(inputCls, 'border-accent/30 focus:border-accent')} value={fields.partner_email ?? ''} onChange={e => setField('partner_email', e.target.value)} placeholder="email@pareja.com" />
            </div>
            <div>
              <FieldLabel required={sf.partner_phone}>Teléfono</FieldLabel>
              <input type="tel" className={cn(inputCls, 'border-accent/30 focus:border-accent')} value={fields.partner_phone ?? ''} onChange={e => setField('partner_phone', e.target.value)} placeholder="+34 600 000 000" />
            </div>
            <div>
              <FieldLabel required={sf.partner_level}>Nivel</FieldLabel>
              <input type="number" className={cn(numberCls, 'border-accent/30 focus:border-accent')} value={fields.partner_level ?? ''} onChange={e => setField('partner_level', e.target.value)} placeholder="1-10" min="1" max="10" />
            </div>
            <div>
              <FieldLabel required>Lado en pista</FieldLabel>
              <div className="flex rounded-[8px] border border-accent/30 overflow-hidden w-fit">
                {(['Derecha', 'Reves'] as const).map(side => (
                  <button key={side} type="button"
                    onClick={() => setField('partner_side', side)}
                    className={cn('px-5 py-2.5 text-[13px] font-semibold transition-colors',
                      fields.partner_side === side ? 'bg-accent text-white' : 'bg-background text-muted-foreground hover:text-foreground'
                    )}
                  >{side}</button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Custom fields ─────────────────────────────────────── */}
      {config.custom_fields.filter(cf =>
        cf.applies_to === 'all' || (isPair && cf.applies_to === 'pair') || (!isPair && cf.applies_to === 'individual')
      ).map(cf => (
        <div key={cf.id}>
          {cf.type !== 'checkbox' && <FieldLabel required={cf.required}>{cf.label}</FieldLabel>}
          {cf.type === 'text' && (
            <input className={inputCls} value={fields[cf.id] ?? ''} onChange={e => setField(cf.id, e.target.value)} />
          )}
          {cf.type === 'number' && (
            <input type="number" className={numberCls} value={fields[cf.id] ?? ''} onChange={e => setField(cf.id, e.target.value)} />
          )}
          {cf.type === 'select' && (
            <select className={inputCls} value={fields[cf.id] ?? ''} onChange={e => setField(cf.id, e.target.value)}>
              <option value="">Selecciona…</option>
              {cf.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {cf.type === 'checkbox' && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={checks[cf.id] ?? false} onChange={e => setChecks(c => ({ ...c, [cf.id]: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded border-border accent-accent shrink-0" />
              <span className="text-[13px] text-foreground">
                {cf.label}
                {cf.required ? <span className="text-[var(--error)] ml-0.5">*</span> : <span className="text-muted-foreground ml-1 text-[12px]">(opcional)</span>}
              </span>
            </label>
          )}
        </div>
      ))}

      {/* ── Conditions ────────────────────────────────────────── */}
      <div className="border-t border-border pt-4">
        <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">
          Al inscribirte confirmas que conoces las normas del torneo y aceptas las condiciones de participación establecidas por el organizador.
        </p>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={conditions} onChange={e => setConditions(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border accent-accent shrink-0" />
          <span className="text-[13px] text-foreground">
            Acepto los términos y condiciones
            {sf.conditions ? <span className="text-[var(--error)] ml-0.5">*</span> : <span className="text-muted-foreground ml-1 text-[12px]">(opcional)</span>}
          </span>
        </label>
      </div>

      {error && <p className="text-[13px] text-[var(--error)] bg-[var(--error)]/5 border border-[var(--error)]/20 rounded-[6px] px-3 py-2">{error}</p>}

      <button onClick={handleSubmit} disabled={loading}
        className="w-full py-3 bg-accent text-white rounded-[8px] text-[14px] font-semibold hover:bg-accent/90 transition-colors disabled:opacity-60">
        {loading ? 'Enviando…' : isFull ? 'Apuntarse a lista de espera' : 'Confirmar inscripción'}
      </button>
    </div>
  )
}

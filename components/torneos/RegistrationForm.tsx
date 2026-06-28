'use client'

import { useState } from 'react'
import { registerForTournament } from '@/lib/actions/registrations'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

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

function FieldLabel({ children, required }: { children: React.ReactNode; required: boolean }) {
  return (
    <label className="block text-[14px] font-medium text-foreground mb-2">
      {children}
      {required
        ? <span className="text-[var(--error)] ml-1 text-[13px]">*</span>
        : <span className="text-muted-foreground font-normal ml-1.5 text-[12px]">(opcional)</span>}
    </label>
  )
}

function SectionBadge({ n, accent }: { n: number; accent?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-bold shrink-0',
      accent ? 'bg-accent/15 text-accent' : 'bg-accent text-white'
    )}>
      {n}
    </span>
  )
}

const inputCls = 'w-full px-3.5 py-3 border border-border rounded-xl text-[15px] bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors'
const numberCls = 'w-28 px-3.5 py-3 border border-border rounded-xl text-[15px] bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors'

// ── Main Component ────────────────────────────────────────────────────────────

interface RegistrationFormProps {
  tournament: Record<string, unknown>
  userId: string
}

export function RegistrationForm({ tournament: t }: RegistrationFormProps) {

  const rawConfig = t.registration_config as RegistrationConfig | null | undefined
  const config: RegistrationConfig = (rawConfig && Array.isArray(rawConfig.custom_fields))
    ? { ...DEFAULT_CONFIG, ...rawConfig, system_fields: { ...DEFAULT_CONFIG.system_fields, ...(rawConfig.system_fields ?? {}) } }
    : DEFAULT_CONFIG

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

      {/* Waitlist warning */}
      {isFull && (
        <div className="bg-[var(--warning-surface,#fff7ed)] border border-[var(--warning)]/40 rounded-xl px-4 py-3 text-[13px] text-[var(--warning)]">
          ⚠️ Este torneo está completo. Puedes apuntarte a la lista de espera.
        </div>
      )}

      {/* ── Jugador 1 ────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-accent/30 bg-accent/[0.08] p-5 flex flex-col gap-4">

        {/* ── Tipo de inscripción ── */}
        {bothEnabled && (
          <div>
            <FieldLabel required>¿Cómo te inscribes?</FieldLabel>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRegType('pair')}
                className={cn(
                  'flex-1 py-3 rounded-xl border text-[14px] font-semibold transition-all',
                  isPair
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-background/70 text-foreground border-border hover:bg-background'
                )}>
                En pareja
              </button>
              <button type="button" onClick={() => setRegType('individual')}
                className={cn(
                  'flex-1 py-3 rounded-xl border text-[14px] font-semibold transition-all',
                  !isPair
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-background/70 text-foreground border-border hover:bg-background'
                )}>
                Individual
              </button>
            </div>
          </div>
        )}

        {/* ── Categoría ── */}
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
                    'px-5 py-2 rounded-full border text-[14px] font-medium transition-all',
                    fields.category === cat
                      ? 'bg-accent text-white border-accent shadow-sm'
                      : 'bg-background/70 text-foreground border-border hover:bg-background'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <SectionBadge n={1} />
          <span className="text-[15px] font-semibold text-foreground">Tus datos</span>
        </div>

        {sf.name && (
          <div>
            <FieldLabel required={sf.name}>Nombre completo</FieldLabel>
            <input className={inputCls} value={fields.name ?? ''} onChange={e => setField('name', e.target.value)} placeholder="Tu nombre y apellido" />
          </div>
        )}
        {sf.email && (
          <div>
            <FieldLabel required={sf.email}>Email</FieldLabel>
            <input type="email" className={inputCls} value={fields.email ?? ''} onChange={e => setField('email', e.target.value)} placeholder="tu@email.com" />
          </div>
        )}
        {sf.phone && (
          <div>
            <FieldLabel required={sf.phone}>Teléfono</FieldLabel>
            <input type="tel" className={inputCls} value={fields.phone ?? ''} onChange={e => setField('phone', e.target.value)} placeholder="+34 600 000 000" />
          </div>
        )}
        <div>
          <FieldLabel required={sf.level}>Nivel</FieldLabel>
          <input type="number" className={numberCls} value={fields.level ?? ''} onChange={e => setField('level', e.target.value)} placeholder="1-10" min="1" max="10" />
        </div>
        <div>
          <FieldLabel required>Lado en pista</FieldLabel>
          <div className="flex gap-2">
            {(['Derecha', 'Reves'] as const).map(side => (
              <button key={side} type="button"
                onClick={() => setField('side', side)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl border text-[14px] font-semibold transition-all',
                  fields.side === side
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-muted text-foreground border-transparent hover:bg-muted/80'
                )}
              >{side}</button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Jugador 2 ────────────────────────────────────────────── */}
      {isPair && (
        <section className="rounded-2xl border border-accent/30 bg-accent/[0.08] p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <SectionBadge n={2} accent />
            <span className="text-[15px] font-semibold text-accent">Datos de tu pareja</span>
          </div>

          {sf.partner_name && (
            <div>
              <FieldLabel required={sf.partner_name}>Nombre completo</FieldLabel>
              <input className={inputCls} value={fields.partner_name ?? ''} onChange={e => setField('partner_name', e.target.value)} placeholder="Nombre y apellido de tu pareja" />
            </div>
          )}
          {sf.partner_email && (
            <div>
              <FieldLabel required={sf.partner_email}>Email</FieldLabel>
              <input type="email" className={inputCls} value={fields.partner_email ?? ''} onChange={e => setField('partner_email', e.target.value)} placeholder="email@pareja.com" />
            </div>
          )}
          {sf.partner_phone && (
            <div>
              <FieldLabel required={sf.partner_phone}>Teléfono</FieldLabel>
              <input type="tel" className={inputCls} value={fields.partner_phone ?? ''} onChange={e => setField('partner_phone', e.target.value)} placeholder="+34 600 000 000" />
            </div>
          )}
          <div>
            <FieldLabel required={sf.partner_level}>Nivel</FieldLabel>
            <input type="number" className={numberCls} value={fields.partner_level ?? ''} onChange={e => setField('partner_level', e.target.value)} placeholder="1-10" min="1" max="10" />
          </div>
          <div>
            <FieldLabel required>Lado en pista</FieldLabel>
            <div className="flex gap-2">
              {(['Derecha', 'Reves'] as const).map(side => (
                <button key={side} type="button"
                  onClick={() => setField('partner_side', side)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl border text-[14px] font-semibold transition-all',
                    fields.partner_side === side
                      ? 'bg-accent text-white border-accent shadow-sm'
                      : 'bg-muted text-foreground border-transparent hover:bg-muted/80'
                  )}
                >{side}</button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Custom fields ─────────────────────────────────────────── */}
      {(() => {
        const visibleCustom = config.custom_fields.filter(cf =>
          cf.applies_to === 'all' || (isPair && cf.applies_to === 'pair') || (!isPair && cf.applies_to === 'individual')
        )
        if (visibleCustom.length === 0) return null
        return (
          <section className="rounded-2xl border border-accent/30 bg-accent/[0.08] p-5 flex flex-col gap-4">
            {visibleCustom.map(cf => (
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
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={checks[cf.id] ?? false} onChange={e => setChecks(c => ({ ...c, [cf.id]: e.target.checked }))}
                      className="mt-0.5 w-5 h-5 rounded border-border accent-accent shrink-0" />
                    <span className="text-[14px] text-foreground">
                      {cf.label}
                      {cf.required ? <span className="text-[var(--error)] ml-1">*</span> : <span className="text-muted-foreground ml-1.5 text-[12px]">(opcional)</span>}
                    </span>
                  </label>
                )}
              </div>
            ))}
          </section>
        )
      })()}

      {/* ── Condiciones ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-muted/30 p-4">
        <p className="text-[13px] text-muted-foreground mb-3 leading-relaxed">
          Al inscribirte confirmas que conoces las normas del torneo y aceptas las condiciones de participación establecidas por el organizador.
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={conditions} onChange={e => setConditions(e.target.checked)}
            className="w-5 h-5 rounded border-border accent-accent shrink-0" />
          <span className="text-[14px] font-medium text-foreground">
            Acepto los términos y condiciones
            {sf.conditions ? <span className="text-[var(--error)] ml-1">*</span> : <span className="text-muted-foreground font-normal ml-1.5 text-[12px]">(opcional)</span>}
          </span>
        </label>
      </div>

      {error && (
        <p className="text-[13px] text-[var(--error)] bg-[var(--error)]/5 border border-[var(--error)]/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button onClick={handleSubmit} disabled={loading}
        className="w-full py-4 bg-accent text-white rounded-xl text-[15px] font-semibold hover:bg-accent/90 transition-all shadow-sm disabled:opacity-60">
        {loading ? 'Enviando…' : isFull ? 'Apuntarse a lista de espera' : 'Confirmar inscripción'}
      </button>

    </div>
  )
}

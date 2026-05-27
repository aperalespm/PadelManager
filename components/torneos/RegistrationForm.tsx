'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerForTournament } from '@/lib/actions/registrations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Users, User, AlertTriangle } from 'lucide-react'

interface RegistrationFormProps {
  tournament: Record<string, unknown>
  userId: string
}

export function RegistrationForm({ tournament: t, userId }: RegistrationFormProps) {
  const router = useRouter()
  const [type, setType] = useState('pair')
  const [partner, setPartner] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const confirmed = (t.confirmed_count as number) ?? 0
  const maxPlayers = (t.max_players as number) ?? 0
  const isFull = confirmed >= maxPlayers

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const result = await registerForTournament({
        tournament_id: t.id as string,
        player2_name: type === 'pair' ? partner : undefined,
      })
      if ('error' in result) {
        setError(result.error as string)
        return
      }
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
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="text-4xl">🎉</div>
        <h2 className="text-xl font-bold text-foreground">¡Inscripción enviada!</h2>
        <p className="text-muted-foreground text-sm">El organizador revisará tu inscripción pronto.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {isFull && (
        <Alert className="bg-[var(--warning-surface)] border-[var(--warning)]">
          <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
          <AlertDescription className="text-[var(--warning)]">
            Este torneo está completo. Puedes apuntarte a la lista de espera.
          </AlertDescription>
        </Alert>
      )}

      {/* Tournament summary */}
      <Card className="p-4 bg-[var(--accent-surface)] border-accent/30">
        <h3 className="font-semibold text-foreground">{t.name as string}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t.venue_name as string}</p>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline" className="text-xs">{t.category as string}</Badge>
          <Badge variant="outline" className="text-xs">{confirmed}/{maxPlayers} plazas</Badge>
        </div>
      </Card>

      {/* Type selection */}
      {(t.registration_type as string) !== 'individual' && (
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Tipo de inscripción</Label>
          <RadioGroup value={type} onValueChange={setType} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="pair" id="pair" />
              <Label htmlFor="pair" className="flex items-center gap-1.5 cursor-pointer">
                <Users className="w-4 h-4" /> Pareja
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="individual" id="individual" />
              <Label htmlFor="individual" className="flex items-center gap-1.5 cursor-pointer">
                <User className="w-4 h-4" /> Individual
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {type === 'pair' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="partner">Nombre de tu compañero/a</Label>
          <Input
            id="partner"
            placeholder="Nombre del compañero/a"
            value={partner}
            onChange={e => setPartner(e.target.value)}
          />
        </div>
      )}

      <Separator />

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={loading || (type === 'pair' && !partner)}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
      >
        {loading ? 'Procesando...' : isFull ? 'Apuntarse a lista de espera' : 'Confirmar inscripción'}
      </Button>
    </div>
  )
}

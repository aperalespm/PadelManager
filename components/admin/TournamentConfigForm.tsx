'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTournament } from '@/lib/actions/tournaments'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TournamentConfigFormProps {
  tournament: Record<string, unknown>
}

export function TournamentConfigForm({ tournament: t }: TournamentConfigFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(t.name as string ?? '')
  const [description, setDescription] = useState(t.description as string ?? '')
  const [maxPlayers, setMaxPlayers] = useState(String(t.max_players ?? 32))
  const [priceInfo, setPriceInfo] = useState(t.price_info as string ?? '')
  const [registrationType, setRegistrationType] = useState(t.registration_type as string ?? 'pair')
  const [startDate, setStartDate] = useState(
    t.start_date ? new Date(t.start_date as string).toISOString().split('T')[0] : ''
  )
  const [endDate, setEndDate] = useState(
    t.end_date ? new Date(t.end_date as string).toISOString().split('T')[0] : ''
  )
  const [cancelDeadline, setCancelDeadline] = useState(
    t.cancel_deadline ? new Date(t.cancel_deadline as string).toISOString().split('T')[0] : ''
  )
  const [error, setError] = useState('')

  function handleSave() {
    startTransition(async () => {
      setError('')
      const result = await updateTournament(t.id as string, {
        name,
        description: description || undefined,
        max_players: parseInt(maxPlayers),
        price_info: priceInfo || undefined,
        registration_type: registrationType,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        cancel_deadline: cancelDeadline ? new Date(cancelDeadline).toISOString() : undefined,
      })
      if ('error' in result) {
        setError(result.error as string)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground">{t.name as string}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isPending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

      <Tabs defaultValue="datos">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="datos">Datos básicos</TabsTrigger>
          <TabsTrigger value="instalacion">Instalación</TabsTrigger>
          <TabsTrigger value="categorias">Categorías y formato</TabsTrigger>
          <TabsTrigger value="puntuacion">Puntuación</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6 grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">Nombre del torneo *</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Fecha de inicio *</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Fecha de fin</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Plazas máximas *</Label>
              <Input type="number" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Precio</Label>
              <Input value={priceInfo} onChange={e => setPriceInfo(e.target.value)} placeholder="15 €" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de inscripción *</Label>
              <Select value={registrationType} onValueChange={setRegistrationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pair">Pareja — inscripción conjunta</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Fecha límite de cancelación</Label>
              <Input type="date" value={cancelDeadline} onChange={e => setCancelDeadline(e.target.value)} />
            </div>

            {/* Image upload placeholder */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Logo / Imagen de portada</Label>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
                🖼 Arrastra o selecciona una imagen · PNG, JPG · máx. 8 MB
              </div>
            </div>

            <div className="col-span-2 bg-[var(--accent-surface)] border border-accent/30 rounded-lg px-4 py-2.5 text-sm text-accent">
              💡 Usa las pestañas Instalación, Categorías y Puntuación para completar la configuración del torneo.
            </div>
          </div>
        </TabsContent>

        <TabsContent value="instalacion" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground">Configuración de instalación pendiente de implementar.</p>
          </div>
        </TabsContent>

        <TabsContent value="categorias" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground">Configuración de categorías pendiente de implementar.</p>
          </div>
        </TabsContent>

        <TabsContent value="puntuacion" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground">Configuración de puntuación pendiente de implementar.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

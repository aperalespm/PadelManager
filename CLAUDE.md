# CLAUDE.md — Reglas del proyecto

> Lee este archivo completo antes de escribir cualquier línea de código.
> Estas reglas tienen **máxima prioridad** sobre cualquier convención por defecto.
> Cuando tengas dudas entre dos opciones técnicas, **explica ambas al usuario en español claro** y espera su decisión.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15, App Router, TypeScript |
| Estilos | Tailwind CSS v4 (sin tailwind.config.js) |
| Componentes | shadcn/ui — style new-york |
| Iconos | Lucide React (único permitido) |
| Fuente | Geist + Geist Mono (paquete `geist`) |
| Dark mode | next-themes |
| Base de datos | Neon Postgres (`@neondatabase/serverless`) |
| Auth | Neon Auth (`@neondatabase/auth`) — email/password |
| IA | Anthropic SDK (`@anthropic-ai/sdk`) — sin streaming |
| Validación | Zod (`zod`) |
| Deploy | Vercel |

---

## Diseño — MÁXIMA PRIORIDAD

### Mobile-first
Estas apps se usan principalmente en móvil. Diseña siempre para pantalla pequeña primero.

```tsx
// ✅ CORRECTO — mobile primero, luego se adapta a desktop
<div className="flex flex-col gap-4 md:flex-row md:gap-6">
<div className="text-sm md:text-base">
<div className="px-4 md:px-8">

// ❌ INCORRECTO — desktop primero
<div className="hidden md:block">  {/* oculto en móvil */}
```

### Fuente
Geist está configurada en `layout.tsx` con variables CSS. El body usa `font-sans` automáticamente.

### Colores — REGLA ABSOLUTA
**NUNCA uses colores hardcodeados. SIEMPRE usa las clases de Tailwind que mapean a variables CSS.**

```tsx
// ✅ CORRECTO
<div className="bg-background text-foreground">
<div className="bg-card text-card-foreground">
<div className="bg-accent text-accent-foreground">
<div className="bg-muted text-muted-foreground">
<div className="bg-success text-success-foreground">
<div className="bg-error text-error-foreground">

// Para estados hover/surface (valor arbitrario apuntando a variable CSS)
<div className="bg-[var(--accent-surface)]">   // fondo azul muy sutil
<div className="bg-[var(--success-surface)]">  // fondo verde muy sutil
<div className="bg-[var(--error-surface)]">    // fondo rojo muy sutil

// ❌ NUNCA
<div className="bg-blue-500 text-white">
<div style={{ backgroundColor: '#0075C8' }}>
<div className="bg-[#F8F7F2]">
```

### Border radius
```
rounded-lg  →  0.75rem  ← el más usado en cards y botones
rounded-md  →  0.5rem
rounded-xl  →  1rem
rounded-full → píldoras y avatares
```

---

## Componentes — usa los de `components/ui/` siempre

Lista de componentes disponibles (NO los reinventes con Tailwind):
`Button` · `Card` · `Badge` · `Input` · `Label` · `Textarea` · `Select`
`Dialog` · `Sheet` · `Drawer` · `Popover` · `Tooltip` · `DropdownMenu`
`Tabs` · `Accordion` · `Progress` · `Skeleton` · `Avatar` · `Checkbox`
`Switch` · `RadioGroup` · `Slider` · `Calendar` · `Table` · `Pagination`
`Alert` · `AlertDialog` · `Form` · `Breadcrumb` · `NavigationMenu`
`ScrollArea` · `Separator` · `Carousel` · `Chart` · `Empty`

### Variantes de Button
```tsx
<Button variant="accent">      // azul — CTA principal (la acción más importante)
<Button variant="secondary">   // carbón — CTA secundario fuerte
<Button variant="outline">     // con borde — acción terciaria
<Button variant="ghost">       // sin fondo — acción sutil, icono
<Button variant="destructive"> // rojo — eliminar / acción irreversible
<Button variant="link">        // link
```

---

## Arquitectura — cómo está organizado el código

```
app/
  globals.css              ← NO modificar
  layout.tsx               ← ThemeProvider + Geist configurados
  (auth)/                  ← rutas públicas: login, registro
    login/page.tsx
    register/page.tsx
  (app)/                   ← rutas protegidas (requieren login)
    layout.tsx             ← comprueba sesión, redirige si no hay login
    dashboard/page.tsx
    [feature]/page.tsx
  api/                     ← solo para webhooks externos o integraciones
components/
  ui/                      ← DS components (NO modificar)
  theme-provider.tsx       ← NO modificar
  [feature]/               ← componentes específicos de esta app
lib/
  utils.ts                 ← función cn() — NO modificar
  db.ts                    ← cliente Neon
  auth.ts                  ← configuración Neon Auth (servidor)
  auth-client.ts           ← configuración Neon Auth (cliente)
  validations.ts           ← schemas Zod
  prompts.ts               ← carga system prompts desde DB
  actions/                 ← Server Actions (llamadas a IA, mutaciones de DB)
    ai.ts
    [feature].ts
```

---

## Server Actions — dónde va la lógica del servidor

**¿Qué es un Server Action?** Es una función que se ejecuta en el servidor (no en el navegador del usuario). El usuario no puede verla ni acceder a ella directamente. Se usa para: llamar a la IA, escribir en la base de datos, enviar emails, etc.

```ts
// lib/actions/ai.ts
'use server'   // ← esto indica que la función corre en el servidor

import Anthropic from '@anthropic-ai/sdk'
import { getSystemPrompt } from '@/lib/prompts'

export async function callAI(userMessage: string) {
  // ✅ Aquí sí podemos usar la API key — está en el servidor
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const systemPrompt = await getSystemPrompt('main')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
```

**Cuándo usar API routes en lugar de Server Actions:**
- Para webhooks que llama un servicio externo (Stripe, etc.)
- Si en el futuro otra app necesita llamar al mismo endpoint
- En el resto de casos: Server Actions

---

## Sistema de prompts — guardados en Neon

Los system prompts de la IA NO van hardcodeados en el código. Se guardan en la base de datos para poder editarlos sin hacer deploy.

### Tabla en Neon

```sql
CREATE TABLE ai_prompts (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL UNIQUE,  -- identificador, ej: 'wine-pairing-main'
  content   TEXT NOT NULL,         -- el system prompt completo
  version   INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Cómo cargarlo

```ts
// lib/prompts.ts
import { sql } from '@/lib/db'

export async function getSystemPrompt(name: string): Promise<string> {
  const result = await sql`
    SELECT content FROM ai_prompts WHERE name = ${name} LIMIT 1
  `
  if (!result[0]) throw new Error(`Prompt '${name}' not found in database`)
  return result[0].content
}
```

---

## Validación con Zod

**¿Qué es Zod?** Es una biblioteca que comprueba que los datos tienen el formato correcto antes de procesarlos. Piensa en ello como un guarda de seguridad en la puerta: si el usuario manda un texto donde debería ir un número, o manda un campo vacío obligatorio, Zod lo detecta y devuelve un error claro antes de que llegue a la base de datos o a la IA.

```ts
// lib/validations.ts
import { z } from 'zod'

// Ejemplo: validar lo que el usuario manda al agente de IA
export const aiRequestSchema = z.object({
  message: z.string().min(1, 'El mensaje no puede estar vacío').max(2000),
  context: z.string().optional(),
})

// En el Server Action:
export async function callAI(input: unknown) {
  'use server'
  const parsed = aiRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Datos inválidos', details: parsed.error.flatten() }
  }
  // ... continúa con parsed.data que ya es seguro
}
```

**Regla:** Usa Zod en todos los Server Actions que reciben input del usuario.

---

## Auth — Neon Auth

### Servidor (Server Components y Server Actions)
```ts
import { auth } from '@/lib/auth'
const session = await auth.getSession()
if (!session) return { error: 'No autorizado' }
const userId = session.user.id  // session.user: { id, name, email, image }
```

### Cliente ('use client')
```ts
import { authClient } from '@/lib/auth-client'
await authClient.signIn.email({ email, password })
await authClient.signUp.email({ email, password, name })
await authClient.signOut()
```

### Middleware — protección de rutas
```ts
// middleware.ts
import { auth } from '@/lib/auth'
export default auth.middleware({ loginUrl: '/login' })
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
```

### API route — requerida para que funcione el auth
```ts
// app/api/auth/[...path]/route.ts
import { auth } from '@/lib/auth'
export const { GET, POST } = auth.handler()
```

---

## Base de datos — Neon

```ts
// lib/db.ts
import { neon } from '@neondatabase/serverless'
export const sql = neon(process.env.DATABASE_URL!)
```

### Regla de multitenancy — CRÍTICO
Cada usuario ES su propio tenant. `user_id` es el identificador de aislamiento.
**TODAS las queries deben filtrar por `user_id`.**

```ts
// ✅ CORRECTO — siempre filtrar por user_id
const records = await sql`
  SELECT * FROM records
  WHERE user_id = ${userId}
  ORDER BY created_at DESC
`

// ❌ NUNCA — sin filtro expone datos de todos los usuarios
const records = await sql`SELECT * FROM records`
```

---

## IA — Anthropic SDK

```ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Llamada estándar (sin streaming)
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: systemPrompt,   // ← cargado desde DB con getSystemPrompt()
  messages: [{ role: 'user', content: userMessage }],
})

const text = response.content[0].type === 'text' ? response.content[0].text : ''
```

---

## Variables de entorno

### `.env.local` (desarrollo local — NUNCA subir a GitHub)
```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
```

### En Vercel (producción)
Configura estas mismas variables en el panel de Vercel → Settings → Environment Variables.

### Regla crítica: NEXT_PUBLIC_ prefix
- Variables con `NEXT_PUBLIC_` son **visibles en el navegador** del usuario.
- **NUNCA** pongas API keys, secrets ni passwords en variables `NEXT_PUBLIC_`.
- Las variables de Neon Auth son secretos de servidor — nunca en `NEXT_PUBLIC_`.

---

## Seguridad — reglas absolutas

### Lo que NUNCA debes hacer
- ❌ Usar `ANTHROPIC_API_KEY` en un componente cliente (`'use client'`)
- ❌ Hacer llamadas a Anthropic desde el navegador directamente
- ❌ Poner secrets en variables `NEXT_PUBLIC_`
- ❌ Exponer errores internos al usuario (no mostrar stack traces, mensajes de DB, etc.)
- ❌ Hacer queries a Neon sin filtro `WHERE user_id = ${userId}`
- ❌ Guardar imágenes o archivos del usuario sin su consentimiento explícito
- ❌ Loggear datos sensibles del usuario en consola en producción

### Manejo de errores visible al usuario
```tsx
// ✅ CORRECTO — mensaje genérico al usuario, log interno
try {
  const result = await callAI(input)
  return result
} catch (error) {
  console.error('AI call failed:', error)  // solo en servidor
  return { error: 'Ha ocurrido un error. Por favor, inténtalo de nuevo.' }
}

// ❌ NUNCA mostrar el error técnico al usuario
return { error: error.message }  // puede exponer info interna
```

---

## Estados de UI — manejo obligatorio

Toda operación asíncrona (llamada a IA, fetch de datos) debe tener tres estados visibles:

```tsx
// 1. Loading — usar Skeleton o spinner
import { Skeleton } from '@/components/ui/skeleton'
{isLoading && <Skeleton className="h-32 w-full rounded-lg" />}

// 2. Error — usar Alert o mensaje visible
import { Alert } from '@/components/ui/alert'
{error && <Alert variant="destructive">{error}</Alert>}

// 3. Vacío — usar Empty
import { Empty } from '@/components/ui/empty'
{data.length === 0 && <Empty title="Sin resultados" description="..." />}
```

---

## Iconos

**Solo Lucide React.** Sin excepciones.

```tsx
import { Search, Plus, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react'
// Loader2 para estados de carga: <Loader2 className="animate-spin" size={18} />
```

Tamaños recomendados: `size={16}` inline · `size={18}` en botones · `size={20}` acciones · `size={24}` headers

---

## Reglas finales

- ❌ No instales otras librerías de iconos
- ❌ No crees `tailwind.config.js` — v4 no lo necesita
- ❌ No modifiques `components/ui/` ni `globals.css` sin avisar
- ❌ No uses `any` en TypeScript — define siempre los tipos
- ✅ Explica las opciones técnicas al usuario en español claro antes de elegir
- ✅ Maneja siempre loading, error y estado vacío en la UI
- ✅ Todas las llamadas a Anthropic van en Server Actions, nunca en el cliente
- ✅ Valida con Zod antes de escribir en la DB o llamar a la IA

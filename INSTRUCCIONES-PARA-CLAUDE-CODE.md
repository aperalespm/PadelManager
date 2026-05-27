# Design System — Instrucciones para Claude Code

> **Lee este archivo completo antes de crear o modificar cualquier componente o página.**

---

## ⚠️ CRÍTICO: Este DS usa Tailwind v4, NO v3

`npx create-next-app` instala Tailwind v3 por defecto. Este DS requiere **Tailwind v4**.
Si el proyecto tiene `tailwind.config.js` en la raíz, **bórralo** — v4 no lo necesita.
La configuración de Tailwind está enteramente en `app/globals.css`.

---

## Stack requerido

- **Next.js 15** — App Router, TypeScript
- **Tailwind CSS v4** — sin config.js, configurado vía CSS
- **shadcn/ui** — style `new-york`, con los componentes de `components/ui/`
- **Lucide React** — ÚNICOS iconos permitidos
- **next-themes** — dark mode
- **Fuente: Geist** — vía paquete npm `geist`

---

## Setup de un proyecto nuevo — paso a paso

### 1. Crear el proyecto

```bash
npx create-next-app@latest nombre-app \
  --typescript --tailwind --app \
  --no-src-dir --import-alias "@/*"
```

### 2. Instalar dependencias del DS

```bash
npm install geist next-themes class-variance-authority clsx tailwind-merge \
  @radix-ui/react-slot lucide-react
```

### 3. Actualizar Tailwind a v4

```bash
npm install tailwindcss@latest @tailwindcss/postcss@latest
```

Actualizar `postcss.config.mjs`:

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
export default config
```

**Eliminar `tailwind.config.js`** si existe — no se usa en v4.

### 4. Copiar archivos del DS al proyecto

```
globals.css              → app/globals.css              (REEMPLAZA el existente)
components.json          → components.json              (raíz del proyecto)
components/ui/           → components/ui/               (todos los archivos)
components/theme-provider.tsx → components/theme-provider.tsx
lib/utils.ts             → lib/utils.ts
```

### 5. Configurar la fuente Geist en `app/layout.tsx`

```tsx
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

---

## Paleta de colores

### Modo claro
| Token | Valor | Uso |
|---|---|---|
| `--background` | `#F8F7F2` crema | Fondo de página |
| `--foreground` | `#1D252D` carbón | Texto principal |
| `--card` | `#FFFFFF` | Fondo de cards |
| `--card-secondary` | `#F0EFE9` | Cards secundarias |
| `--accent` | `#0075C8` azul | CTAs, links, foco |
| `--success` | `#5A8C1A` verde | Estados positivos |
| `--error` | `#D4583B` terracota | Errores, alertas |
| `--muted` | `#E8E7E1` | Fondos neutros |
| `--muted-foreground` | `#6B7280` | Texto secundario |
| `--border` | `#D9D8D2` | Bordes |

### Modo oscuro (se activa automáticamente con clase `.dark`)
| Token | Valor |
|---|---|
| `--background` | `#1D252D` carbón |
| `--foreground` | `#F8F7F2` crema |
| `--accent` | `#3B9AE1` azul claro |
| `--card` | `#252E37` |

### Estados adicionales (hover, surface)
```css
var(--accent-hover)      /* #005FA3 — hover de botones azules */
var(--accent-surface)    /* #E5F2FB — fondo sutil de elementos accent */
var(--success-surface)   /* #E6F4C4 — fondo de alertas de éxito */
var(--error-surface)     /* #FAEEE9 — fondo de alertas de error */
var(--warning-surface)   /* #FEF3E2 — fondo de alertas de warning */
```

---

## Tipografía

- **Fuente**: Geist (`font-sans`) / Geist Mono (`font-mono`)
- **Color de texto**: siempre usar variables, nunca hex hardcodeado

```tsx
// Texto principal
<p className="text-foreground">...</p>
// Texto secundario
<p className="text-muted-foreground">...</p>
// Texto terciario (más apagado)
<p className="text-[var(--color-text-tertiary)]">...</p>
// Texto deshabilitado
<p className="text-[var(--color-text-disabled)]">...</p>
```

Tamaños disponibles (escala Tailwind estándar + `text-md`):
- `text-xs` (12px) · `text-sm` (14px) · `text-md` (15px) · `text-base` (16px)
- `text-lg` (18px) · `text-xl` (20px) · `text-2xl` (24px) · `text-3xl` (30px)

---

## Border radius

```
--radius-sm: 0.375rem   rounded-sm (o rounded-[var(--radius-sm)])
--radius-md: 0.5rem     rounded-md
--radius-lg: 0.75rem    rounded-lg  ← el más usado en cards y botones
--radius-xl: 1rem       rounded-xl
```

---

## Componentes disponibles en `components/ui/`

Usa SIEMPRE estos componentes. No reinventes con Tailwind lo que ya existe.

### Botones

```tsx
import { Button } from '@/components/ui/button'

// CTA principal (azul) — para la acción más importante de la página
<Button variant="accent">Guardar</Button>

// Botón oscuro (carbón) — acción secundaria importante
<Button variant="secondary">Ver más</Button>

// Con borde — acción terciaria
<Button variant="outline">Cancelar</Button>

// Sin fondo — acción sutil
<Button variant="ghost">Descartar</Button>

// Destructivo (rojo) — eliminar, borrar
<Button variant="destructive">Eliminar</Button>

// Link
<Button variant="link">Ver detalles</Button>

// Tamaños
<Button variant="accent" size="sm">Pequeño</Button>
<Button variant="accent" size="lg">Grande</Button>
<Button variant="accent" size="icon"><PlusIcon /></Button>
```

### Cards

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descripción o subtítulo</CardDescription>
  </CardHeader>
  <CardContent>
    {/* contenido */}
  </CardContent>
  <CardFooter>
    <Button variant="accent">Acción</Button>
  </CardFooter>
</Card>
```

### Badges

```tsx
import { Badge } from '@/components/ui/badge'

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
```

### Inputs y formularios

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="tu@email.com" />
</div>
```

### Otros componentes disponibles

`accordion` · `alert` · `alert-dialog` · `avatar` · `breadcrumb` · `button-group`
`calendar` · `carousel` · `chart` · `checkbox` · `dialog` · `drawer`
`dropdown-menu` · `empty` · `field` · `form` · `input-group` · `item`
`navigation-menu` · `pagination` · `popover` · `progress` · `radio-group`
`scroll-area` · `select` · `separator` · `skeleton` · `slider` · `switch`
`table` · `tabs` · `textarea` · `toast` · `toggle` · `tooltip`

---

## Dark mode

El dark mode se gestiona con `next-themes` + clase `.dark` en `<html>`.
El `ThemeProvider` ya está en `layout.tsx`.

```tsx
// Botón para cambiar tema
'use client'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

---

## Iconos

**Solo Lucide React.** Sin excepciones.

```tsx
import { Search, Plus, ChevronRight, ArrowLeft } from 'lucide-react'

// Tamaños recomendados:
// size={16} — inline, dentro de texto
// size={18} — dentro de botones
// size={20} — acciones standalone
// size={24} — headers y navegación

<Search size={18} className="text-muted-foreground" />
```

---

## Reglas — NUNCA hagas esto

- ❌ Hardcodear colores hex (`#0075C8`, `#F8F7F2`...)
- ❌ Usar clases Tailwind de color hardcodeadas (`bg-blue-500`, `text-gray-700`...)
- ❌ Crear un `tailwind.config.js` — v4 no lo necesita
- ❌ Modificar `globals.css` sin avisar al usuario
- ❌ Usar otras librerías de iconos (heroicons, react-icons...)
- ❌ Mezclar `style={{color: '...'}}` inline con clases del DS
- ❌ Reinstalar shadcn con `npx shadcn init` — ya tienes los componentes copiados

---

## Ejemplo de página completa bien construida

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'

export default function EjemploPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Mi App</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Descripción de la sección
            </p>
          </div>
          <Button variant="accent">
            <Plus size={18} />
            Nueva entrada
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Título de la card</CardTitle>
              <Badge variant="secondary">Activo</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campo de ejemplo</Label>
              <Input placeholder="Escribe algo..." />
            </div>
            <div className="flex gap-2">
              <Button variant="accent">Guardar</Button>
              <Button variant="outline">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

# App Template

Repo plantilla para nuevas apps. Incluye el Design System completo y el stack estándar pre-configurado.

## Stack

- Next.js 15 + App Router + TypeScript
- Tailwind CSS v4 (sin tailwind.config.js)
- shadcn/ui — style new-york (40 componentes en `components/ui/`)
- Geist font
- next-themes (dark mode)
- Neon Postgres
- Stack Auth (Google OAuth + email/password)
- Anthropic SDK
- Zod

## Cómo usar este template

1. Haz clic en **"Use this template"** → "Create a new repository"
2. Ponle nombre a tu nuevo repo
3. Abre el repo en **claude.ai/code**
4. Claude Code leerá `CLAUDE.md` y seguirá el prompt de setup

## Setup manual (si es necesario)

```bash
npm install
cp .env.local.example .env.local
# Rellena las variables en .env.local
npm run dev
```

## Variables de entorno

Ver `.env.local.example` para la lista completa.
**Nunca** subas `.env.local` a GitHub — está en `.gitignore`.

## Design System

Los componentes del DS están en `components/ui/` — **no los modifiques**.
Lee `CLAUDE.md` y el archivo `INSTRUCCIONES-PARA-CLAUDE-CODE.md` del DS para las reglas de uso.

'use server'

import Anthropic from '@anthropic-ai/sdk'
import { sql } from '@/lib/db'
import { z } from 'zod'
import type { TournamentSchedule, ChatMessage } from '@/lib/types/schedule'

const DEMO_ORGANIZER_ID = '00000000-0000-0000-0000-000000000000'

const SCHEDULE_AGENT_PROMPT_FALLBACK = `Eres un agente especializado en organizar calendarios de torneos de pádel.

## TUS TRES MODOS DE OPERACIÓN

### MODO PLANIFICACIÓN
Genera el calendario óptimo que:
- Maximice el número de parejas dentro de los límites de tiempo y pistas
- Respete los máximos y mínimos de grupos y parejas por grupo
- Garantice el mínimo de partidos por pareja
- Sincronice las finales de todas las categorías aproximadamente a la misma hora

## REGLAS QUE NUNCA PUEDES ROMPER

1. **Grupos seguidos**: todos los partidos de un mismo grupo van en slots consecutivos en la misma pista.
2. **Mínimo de partidos garantizado**: cada pareja debe alcanzar minMatchesPerPair.
3. **Sin solapamientos**: dos partidos no pueden ocupar la misma pista al mismo tiempo.
4. **Respetar pausas**: ningún partido puede empezar ni terminar dentro de un bloque de pausa.
5. **Respetar horario de pistas**: cada pista tiene availableFrom y availableUntil.
6. **Transición**: si transitionMins > 0, deja ese tiempo libre entre partidos en la misma pista.
7. **Duración máxima por fase**: nunca asignes más tiempo del indicado en maxDurationMins.

## CÓMO CALCULAR EL CALENDARIO

### Round-robin por número de parejas
- N=3: 3 partidos → [[0,1],[0,2],[1,2]]
- N=4: 6 partidos → [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]]
- N=5: 10 partidos → [[0,1],[2,3],[0,2],[1,4],[0,3],[2,4],[1,3],[0,4],[1,2],[3,4]]

### Distribución de pistas
- Asigna más pistas a las categorías con más partidos para equilibrar tiempos.
- Cuando una categoría pasa de grupos a eliminatoria, libera la pista extra.

### Sincronización de finales
Añade slots vacíos al inicio de las categorías con menos partidos para que todas las finales acaben a la misma hora.

## GESTIÓN DE RESTRICCIONES IMPOSIBLES
Si algo es matemáticamente imposible: explica el motivo con números, ofrece el mejor compromiso y genera ese calendario.

## AJUSTES ITERATIVOS
Cuando el organizador pida un ajuste: aplica solo el cambio solicitado, recalcula los afectados, devuelve el calendario completo actualizado con un resumen de 2-3 líneas.

## FORMATO DE RESPUESTA — OBLIGATORIO

**PARTE 1 — Explicación** (español, máximo 5 líneas):
- Decisiones tomadas, hora estimada de final por categoría, warnings si los hay.

**PARTE 2 — JSON del calendario**:
En una línea sola escribe exactamente: ===SCHEDULE_JSON===
Seguido del JSON con esta estructura exacta (sin bloques de código markdown):
{
  "matches": [
    {
      "id": "string-unico",
      "courtNumber": 1,
      "courtName": "Pista 1",
      "startTime": "10:00",
      "endTime": "10:30",
      "categoryId": "string",
      "categoryName": "1ª",
      "groupId": "string-o-null",
      "phase": "groups",
      "pair1": "Pareja A",
      "pair2": "Pareja B",
      "matchLabel": "1ª Gr.A — P1 vs P2",
      "status": "scheduled"
    }
  ],
  "summary": {
    "totalMatches": 0,
    "estimatedEndTime": "19:30",
    "courtsUsed": 4,
    "matchesPerCategory": {},
    "finalTimes": {},
    "warnings": []
  },
  "rawExplanation": "Resumen breve"
}

## IDIOMA
Responde siempre en español.`

async function getSchedulePrompt(): Promise<string> {
  try {
    const rows = await sql`SELECT content FROM ai_prompts WHERE name = 'schedule_agent' LIMIT 1`
    if (rows[0]?.content) return rows[0].content
  } catch {
    // fallback below
  }
  return SCHEDULE_AGENT_PROMPT_FALLBACK
}

// ── Migrations ────────────────────────────────────────────────────────────────

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS ai_prompts (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL UNIQUE,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS tournament_schedules (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         TEXT NOT NULL,
      tournament_id   UUID NOT NULL UNIQUE,
      schedule_data   JSONB NOT NULL,
      version         INTEGER DEFAULT 1,
      is_published    BOOLEAN DEFAULT false,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS tournament_schedule_chats (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         TEXT NOT NULL,
      tournament_id   UUID NOT NULL UNIQUE,
      messages        JSONB NOT NULL DEFAULT '[]',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    INSERT INTO ai_prompts (name, content)
    VALUES ('schedule_agent', ${SCHEDULE_AGENT_PROMPT_FALLBACK})
    ON CONFLICT (name) DO NOTHING
  `
}

// ── Chat with agent ───────────────────────────────────────────────────────────

const chatSchema = z.object({
  tournamentId: z.string().uuid(),
  userMessage: z.string().min(1).max(2000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  tournamentConfig: z.record(z.string(), z.unknown()),
})

export async function chatWithScheduleAgent(input: unknown): Promise<
  { data: { message: string; schedule: TournamentSchedule | null } } | { error: string }
> {
  const parsed = chatSchema.safeParse(input)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const { userMessage, conversationHistory, tournamentConfig } = parsed.data

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const systemPrompt = await getSchedulePrompt()

  const contextBlock = conversationHistory.length === 0
    ? `CONFIGURACIÓN DEL TORNEO:\n${JSON.stringify(tournamentConfig, null, 2)}\n\n`
    : ''

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8096,
      system: systemPrompt,
      messages: [
        ...conversationHistory.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: `${contextBlock}${userMessage}`,
        },
      ],
    })

    const fullText = response.content[0].type === 'text' ? response.content[0].text : ''
    const parts = fullText.split('===SCHEDULE_JSON===')
    const explanationText = parts[0].trim()
    let schedule: TournamentSchedule | null = null

    if (parts[1]) {
      try {
        const jsonStr = parts[1].trim().replace(/```json|```/g, '').trim()
        schedule = JSON.parse(jsonStr) as TournamentSchedule
      } catch {
        // respuesta sin JSON válido — solo texto
      }
    }

    return { data: { message: explanationText, schedule } }
  } catch {
    return { error: 'Ha ocurrido un error generando el horario. Por favor, inténtalo de nuevo.' }
  }
}

// ── Save schedule + chat ──────────────────────────────────────────────────────

const saveSchema = z.object({
  tournamentId: z.string().uuid(),
  scheduleData: z.record(z.string(), z.unknown()),
  messages: z.array(z.record(z.string(), z.unknown())),
})

export async function saveSchedule(input: unknown): Promise<{ data: { success: true } } | { error: string }> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const { tournamentId, scheduleData, messages } = parsed.data

  try {
    await sql`
      INSERT INTO tournament_schedules (user_id, tournament_id, schedule_data)
      VALUES (${DEMO_ORGANIZER_ID}, ${tournamentId}, ${JSON.stringify(scheduleData)})
      ON CONFLICT (tournament_id)
      DO UPDATE SET
        schedule_data = ${JSON.stringify(scheduleData)},
        version = tournament_schedules.version + 1,
        updated_at = NOW()
    `
    await sql`
      INSERT INTO tournament_schedule_chats (user_id, tournament_id, messages)
      VALUES (${DEMO_ORGANIZER_ID}, ${tournamentId}, ${JSON.stringify(messages)})
      ON CONFLICT (tournament_id)
      DO UPDATE SET
        messages = ${JSON.stringify(messages)},
        updated_at = NOW()
    `
    return { data: { success: true } }
  } catch {
    return { error: 'Ha ocurrido un error guardando el horario.' }
  }
}

// ── Load chat history + schedule ──────────────────────────────────────────────

export async function loadScheduleChat(tournamentId: string): Promise<{
  data: {
    messages: ChatMessage[]
    schedule: TournamentSchedule | null
    version: number
    isPublished: boolean
  }
} | { error: string }> {
  try {
    await ensureTables()

    const [chatRows, scheduleRows] = await Promise.all([
      sql`
        SELECT messages FROM tournament_schedule_chats
        WHERE tournament_id = ${tournamentId}
        LIMIT 1
      `,
      sql`
        SELECT schedule_data, version, is_published FROM tournament_schedules
        WHERE tournament_id = ${tournamentId}
        LIMIT 1
      `,
    ])

    return {
      data: {
        messages: (chatRows[0]?.messages as ChatMessage[]) || [],
        schedule: (scheduleRows[0]?.schedule_data as TournamentSchedule) || null,
        version: (scheduleRows[0]?.version as number) || 0,
        isPublished: (scheduleRows[0]?.is_published as boolean) || false,
      },
    }
  } catch {
    return { error: 'Ha ocurrido un error cargando el historial.' }
  }
}

// ── Publish schedule ──────────────────────────────────────────────────────────

export async function publishSchedule(tournamentId: string): Promise<{ data: { success: true } } | { error: string }> {
  try {
    await sql`
      UPDATE tournament_schedules
      SET is_published = true, updated_at = NOW()
      WHERE tournament_id = ${tournamentId}
    `
    return { data: { success: true } }
  } catch {
    return { error: 'Ha ocurrido un error publicando el horario.' }
  }
}

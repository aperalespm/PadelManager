'use server'

import Anthropic from '@anthropic-ai/sdk'
import { sql } from '@/lib/db'
import { z } from 'zod'
import type { TournamentSchedule, ChatMessage } from '@/lib/types/schedule'

const DEMO_ORGANIZER_ID = '00000000-0000-0000-0000-000000000000'

const SCHEDULE_AGENT_PROMPT_FALLBACK = `Eres un agente especializado en organizar calendarios de torneos de pádel.

## TUS MODOS DE OPERACIÓN

### MODO PLANIFICACIÓN
Genera el calendario óptimo con parejas genéricas (P1, P2…) que:
- Maximice el número de parejas dentro de los límites de tiempo y pistas
- Respete los máximos y mínimos de grupos y parejas por grupo
- Garantice el mínimo de partidos por pareja
- Sincronice las finales de todas las categorías aproximadamente a la misma hora

### MODO ASIGNACIÓN
Se activa automáticamente cuando el sistema te proporciona parejas inscritas reales.

En este modo **debes**:
1. **Asignar parejas a grupos**: distribuye las parejas de cada categoría en los grupos configurados (numGroups × teamsPerGroup). Si el número de parejas no encaja exactamente, reparte de forma equitativa — nunca cambies numGroups ni teamsPerGroup.
2. **Nombres por categoría**:
   - Categorías CON parejas en "PAREJAS INSCRITAS" → usa los nombres reales exactos tal como aparecen.
   - Categorías SIN parejas en "PAREJAS INSCRITAS" → usa SIEMPRE nombres genéricos (P1, P2, P3…). Nunca nombres reales para estas categorías.
3. **Format de matchLabel**: "[CategoríaNombre] Gr.[Letra] — [NombreP1] vs [NombreP2]"
4. **Sin categoría asignada**: si las parejas no llevan categoría, distribúyelas equitativamente entre las categorías configuradas del torneo, o pregunta al organizador cómo hacerlo.
5. **Generar el cuadro de grupos**: cada grupo tiene todas sus parejas y genera los partidos round-robin de la fase de grupos.
6. El calendario actualizado sustituye a cualquier horario previo.

## REGLA ABSOLUTA — FUENTE DE VERDAD PARA NOMBRES DE PAREJAS

Los **ÚNICOS** nombres válidos para pair1, pair2 y matchLabel son los que aparecen en la sección "PAREJAS INSCRITAS" de este prompt.

- Si una categoría NO aparece en "PAREJAS INSCRITAS", usa siempre P1, P2, P3… sin excepción.
- Si ves otros nombres en "HORARIO ACTUALMENTE GENERADO", **IGNÓRALOS**. Pueden ser inscripciones eliminadas o desactualizadas.
- Está **PROHIBIDO** copiar nombres del horario anterior para categorías sin parejas inscritas.

## REGLAS QUE NUNCA PUEDES ROMPER

1. **Grupos seguidos**: todos los partidos de un mismo grupo van en slots consecutivos en la misma pista.
2. **Mínimo de partidos garantizado**: cada pareja debe alcanzar minMatchesPerPair.
3. **Sin solapamientos**: dos partidos no pueden ocupar la misma pista al mismo tiempo.
4. **Respetar pausas**: ningún partido puede empezar ni terminar dentro de un bloque de pausa.
5. **Respetar horario de pistas**: cada pista tiene availableFrom y availableUntil.
6. **Transición**: si transitionMins > 0, deja exactamente ese tiempo libre entre partidos en la misma pista. Si transitionMins = 0, el siguiente partido empieza en el minuto exacto en que termina el anterior.
7. **Duración máxima por fase**: nunca asignes más tiempo del indicado en maxDurationMins.
8. **Sin huecos innecesarios**: NUNCA dejes una pista vacía entre partidos a menos que sea por una pausa configurada o porque no haya más partidos disponibles para esa pista. No redondees los horarios a horas en punto o medias horas si eso crea un hueco.

## REGLA DE ORO — EMPAQUETADO DE PARTIDOS

Cada partido en una pista comienza exactamente cuando termina el anterior más la transición:

  startTime[n+1] = endTime[n] + transitionMins

**Ejemplo** con partidos de 30 min y transitionMins = 10:
- Partido 1: 10:00 → 10:30
- Partido 2: 10:40 → 11:10  ← empieza a los 10 min de que termina el anterior
- Partido 3: 11:20 → 11:50
- Pausa almuerzo: 12:00 → 13:00
- Partido 4: 13:00 → 13:30  ← primera pista libre tras la pausa

**Ejemplo** con partidos de 30 min y transitionMins = 0:
- Partido 1: 10:00 → 10:30
- Partido 2: 10:30 → 11:00  ← inmediatamente después
- Partido 3: 11:00 → 11:30

Está **prohibido** hacer esto (hueco innecesario de 30 min):
- Partido 1: 10:00 → 10:30
- Partido 2: 11:00 → 11:30  ✗ ← hueco de 30 min sin justificación

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
Si algo es matemáticamente imposible con los parámetros del administrador:
explica el motivo con números, propón alternativas (ampliar horario, añadir pistas, segundo día),
pero **nunca cambies el formato (grupos, parejas, fases) sin que el administrador lo pida explícitamente**.

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
  await sql`ALTER TABLE tournament_schedules ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '[]'`
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
    ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
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
  currentSchedule: z.unknown().optional(),
  resetSchedule: z.boolean().optional(),
})

export async function chatWithScheduleAgent(input: unknown): Promise<
  { data: { message: string; schedule: TournamentSchedule | null } } | { error: string }
> {
  const parsed = chatSchema.safeParse(input)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const { userMessage, conversationHistory, tournamentConfig, currentSchedule, resetSchedule } = parsed.data
  // When resetSchedule=true, don't pass the existing schedule so the AI can't
  // carry over invented names from previous generations.
  const scheduleForContext = resetSchedule ? undefined : currentSchedule

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const basePrompt = await getSchedulePrompt()

  // Build system prompt with config always injected.
  // Format params are extracted and listed as hard constraints BEFORE the full
  // JSON so the model can't miss them or quietly override them.
  const fmt = (tournamentConfig.format as Record<string, unknown>) ?? {}
  const constraintBlock = `
## ⚠️ RESTRICCIONES ABSOLUTAS — NUNCA LAS CAMBIES SIN PERMISO EXPLÍCITO

El administrador ha configurado estos valores y son **fijos e inmutables**:

| Parámetro | Valor obligatorio |
|---|---|
| Grupos por categoría | **${fmt.numGroups ?? '?'}** |
| Parejas por grupo | **${fmt.teamsPerGroup ?? '?'}** |
| Parejas que pasan por grupo | **${fmt.teamsAdvancePerGroup ?? '?'}** |
| Partidos mínimos por pareja | **${fmt.minMatchesPerTeam ?? '?'}** |

**PROHIBIDO** reducir grupos, eliminar parejas, saltarse fases o cambiar el formato para "caber" en el horario.

Si el horario es matemáticamente imposible con estos parámetros:
1. Explica el problema con números (tiempo necesario vs disponible).
2. Propón soluciones al administrador: ampliar horario, añadir pistas, segundo día.
3. Genera el calendario lo más completo posible **sin alterar el formato**.
4. Solo cambia el formato si el administrador lo pide de forma explícita.`

  // Registered pairs block — injected in Asignación and En vivo modes
  const tStatus = (tournamentConfig.tournamentStatus as string) ?? 'draft'
  // Active tournaments use assignment mode (real pairs known, same as 'open')
  const modeLabel = (tStatus === 'open' || tStatus === 'active') ? 'ASIGNACIÓN' : 'PLANIFICACIÓN'
  const registeredPairs = tournamentConfig.registeredPairs as Array<{ category: string; pairs: string[] }> | undefined
  const totalPairs = registeredPairs?.reduce((s, c) => s + c.pairs.length, 0) ?? 0

  // All categories configured in the tournament
  const allConfiguredCats = (tournamentConfig.categories as Array<{ id: string; name: string }> | undefined ?? [])
  const categoriesWithPairs = new Set(registeredPairs?.map(c => c.category) ?? [])
  const categoriesWithoutPairs = allConfiguredCats
    .map(c => c.name)
    .filter(name => !categoriesWithPairs.has(name))

  const pairsBlock = registeredPairs && totalPairs > 0
    ? [
        `\n## PAREJAS INSCRITAS — MODO ${modeLabel}`,
        `En este torneo, SOLO las siguientes categorías tienen parejas inscritas reales:\n`,
        ...registeredPairs
          .filter(c => c.pairs.length > 0)
          .map(c =>
            `### ✅ ${c.category || 'Sin categoría asignada'} — USA NOMBRES REALES (${c.pairs.length} parejas)\n` +
            c.pairs.map(p => `- ${p}`).join('\n')
          ),
        categoriesWithoutPairs.length > 0
          ? [
              `\n### ❌ CATEGORÍAS SIN INSCRIPCIONES — USA SIEMPRE NOMBRES GENÉRICOS`,
              `Las siguientes categorías NO tienen ninguna pareja inscrita: **${categoriesWithoutPairs.join(', ')}**`,
              `Para estas categorías DEBES usar nombres genéricos (P1, P2, P3…).`,
              `PROHIBIDO: copiar nombres de horarios anteriores, inventar nombres, usar nombres reales de otras categorías.`,
              `Si el horario previo tenía nombres inventados para estas categorías, IGNÓRALOS y sustitúyelos por P1, P2…`,
            ].join('\n')
          : '',
      ].join('\n')
    : ''

  const systemPrompt = [
    basePrompt,
    constraintBlock,
    pairsBlock,
    '---',
    '## CONFIGURACIÓN DEL TORNEO ACTUAL',
    '```json',
    JSON.stringify(tournamentConfig, null, 2),
    '```',
    scheduleForContext
      ? `\n## HORARIO ACTUALMENTE GENERADO\n\`\`\`json\n${JSON.stringify(scheduleForContext, null, 2)}\n\`\`\``
      : '',
  ].join('\n')

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 32000,
      system: systemPrompt,
      messages: [
        ...conversationHistory.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: userMessage,
        },
      ],
    })

    // Detect truncated responses (hit token limit before finishing JSON)
    if (response.stop_reason === 'max_tokens') {
      return { error: 'La respuesta fue demasiado larga. Prueba a pedir un horario con menos categorías o partidos.' }
    }

    const fullText = response.content[0].type === 'text' ? response.content[0].text : ''
    const parts = fullText.split('===SCHEDULE_JSON===')
    const explanationText = parts[0].trim()
    let schedule: TournamentSchedule | null = null
    let parseError: string | null = null

    if (parts[1]) {
      try {
        const jsonStr = parts[1].trim().replace(/```json|```/g, '').trim()
        schedule = JSON.parse(jsonStr) as TournamentSchedule
      } catch (e) {
        parseError = `No se pudo leer el calendario generado (JSON inválido). ${String(e)}`
      }
    }

    if (parseError && !schedule) {
      return { data: { message: explanationText + '\n\n⚠️ ' + parseError, schedule: null } }
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
  versionLabel: z.string().optional(),
})

export async function saveSchedule(input: unknown): Promise<{ data: { success: true; version: number } } | { error: string }> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const { tournamentId, scheduleData, messages, versionLabel } = parsed.data

  try {
    // Fetch current version_history and version counter
    const existing = await sql`
      SELECT version, COALESCE(version_history, '[]'::jsonb) AS version_history
      FROM tournament_schedules WHERE tournament_id = ${tournamentId}
    `
    const currentVersion = (existing[0]?.version as number) ?? 0
    const nextVersion = currentVersion + 1
    const existingHistory = (existing[0]?.version_history as Array<Record<string, unknown>>) ?? []

    const newEntry = {
      version: nextVersion,
      savedAt: new Date().toISOString(),
      label: versionLabel ?? 'Guardado',
      schedule: scheduleData,
    }
    // Keep last 25 snapshots
    const updatedHistory = [...existingHistory, newEntry].slice(-25)

    await sql`
      INSERT INTO tournament_schedules (user_id, tournament_id, schedule_data, version_history)
      VALUES (${DEMO_ORGANIZER_ID}, ${tournamentId}, ${JSON.stringify(scheduleData)}, ${JSON.stringify(updatedHistory)})
      ON CONFLICT (tournament_id)
      DO UPDATE SET
        schedule_data    = ${JSON.stringify(scheduleData)},
        version          = ${nextVersion},
        version_history  = ${JSON.stringify(updatedHistory)},
        updated_at       = NOW()
    `
    await sql`
      INSERT INTO tournament_schedule_chats (user_id, tournament_id, messages)
      VALUES (${DEMO_ORGANIZER_ID}, ${tournamentId}, ${JSON.stringify(messages)})
      ON CONFLICT (tournament_id)
      DO UPDATE SET
        messages = ${JSON.stringify(messages)},
        updated_at = NOW()
    `
    return { data: { success: true, version: nextVersion } }
  } catch {
    return { error: 'Ha ocurrido un error guardando el horario.' }
  }
}

// ── Load chat history + schedule ──────────────────────────────────────────────

export type VersionSnapshot = {
  version: number
  savedAt: string
  label: string
  schedule: TournamentSchedule
}

export async function loadScheduleChat(tournamentId: string): Promise<{
  data: {
    messages: ChatMessage[]
    schedule: TournamentSchedule | null
    version: number
    isPublished: boolean
    scheduleUpdatedAt: string | null
    versionHistory: VersionSnapshot[]
    lastRegistrationAt: string | null
  }
} | { error: string }> {
  try {
    await ensureTables()

    const [chatRows, scheduleRows, regRows] = await Promise.all([
      sql`
        SELECT messages FROM tournament_schedule_chats
        WHERE tournament_id = ${tournamentId}
        LIMIT 1
      `,
      sql`
        SELECT schedule_data, version, is_published, updated_at,
               COALESCE(version_history, '[]'::jsonb) AS version_history
        FROM tournament_schedules
        WHERE tournament_id = ${tournamentId}
        LIMIT 1
      `,
      sql`
        SELECT MAX(updated_at) AS last_at
        FROM registrations
        WHERE tournament_id = ${tournamentId} AND status = 'confirmed'
      `,
    ])

    const messages = (chatRows[0]?.messages as ChatMessage[]) || []
    let versionHistory = (scheduleRows[0]?.version_history as VersionSnapshot[]) || []

    // Back-fill history from message archive when column was empty (pre-migration sessions)
    if (versionHistory.length === 0 && scheduleRows[0]) {
      const msgSnapshots: VersionSnapshot[] = []
      let num = 1
      for (const m of messages) {
        if (m.role === 'assistant' && m.schedule) {
          msgSnapshots.push({
            version: num++,
            savedAt: m.timestamp,
            label: 'Generado (AI)',
            schedule: m.schedule,
          })
        }
      }
      // Always include the current saved schedule as the last entry
      const currentSchedule = scheduleRows[0].schedule_data as TournamentSchedule
      if (currentSchedule && (msgSnapshots.length === 0 || JSON.stringify(msgSnapshots[msgSnapshots.length - 1].schedule) !== JSON.stringify(currentSchedule))) {
        msgSnapshots.push({
          version: (scheduleRows[0].version as number) || msgSnapshots.length + 1,
          savedAt: scheduleRows[0].updated_at ? String(scheduleRows[0].updated_at) : new Date().toISOString(),
          label: 'Actual',
          schedule: currentSchedule,
        })
      }
      if (msgSnapshots.length > 0) {
        versionHistory = msgSnapshots
        // Persist back-filled history so it's available next time
        await sql`
          UPDATE tournament_schedules
          SET version_history = ${JSON.stringify(msgSnapshots)}, updated_at = updated_at
          WHERE tournament_id = ${tournamentId}
        `
      }
    }

    return {
      data: {
        messages,
        schedule: (scheduleRows[0]?.schedule_data as TournamentSchedule) || null,
        version: (scheduleRows[0]?.version as number) || 0,
        isPublished: (scheduleRows[0]?.is_published as boolean) || false,
        scheduleUpdatedAt: scheduleRows[0]?.updated_at ? String(scheduleRows[0].updated_at) : null,
        versionHistory,
        lastRegistrationAt: regRows[0]?.last_at ? String(regRows[0].last_at) : null,
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

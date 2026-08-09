import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { generateGroupBracket } from '@/lib/actions/bracket'

// Spanish padel player names
const FIRST_NAMES = [
  'Alejandro', 'Carlos', 'David', 'Miguel', 'Javier', 'Pablo', 'Luis', 'Roberto',
  'Fernando', 'Sergio', 'Andrés', 'Eduardo', 'Marcos', 'Rafael', 'Antonio',
  'Diego', 'Rubén', 'Víctor', 'Álvaro', 'Mario', 'Iván', 'Oscar', 'Raúl', 'Alberto',
  'Cristina', 'Laura', 'Marta', 'Elena', 'Sara', 'Ana', 'Patricia', 'Lucía',
  'Isabel', 'Carmen', 'María', 'Pilar', 'Rosa', 'Silvia', 'Natalia', 'Beatriz',
]

const LAST_NAMES = [
  'García', 'López', 'Martínez', 'Sánchez', 'Rodríguez', 'González', 'Fernández',
  'Torres', 'Ruiz', 'Jiménez', 'Navarro', 'Moreno', 'Pérez', 'Díaz', 'Álvarez',
  'Romero', 'Molina', 'Suárez', 'Castro', 'Serrano', 'Blanco', 'Vega', 'Ramos',
  'Herrero', 'Medina', 'Soler', 'Iglesias', 'Delgado', 'Gil', 'Gutiérrez',
]

function randomName(seed: number, offset = 0): string {
  const fi = (seed * 7 + offset * 3) % FIRST_NAMES.length
  const li = (seed * 11 + offset * 5 + 7) % LAST_NAMES.length
  return `${FIRST_NAMES[fi]} ${LAST_NAMES[li]}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('id')
  if (!tournamentId) return NextResponse.json({ error: 'Missing ?id= parameter' }, { status: 400 })

  try {
    // 1. Read tournament venue_details to get categories
    const tRows = await sql`SELECT * FROM tournaments WHERE id = ${tournamentId} LIMIT 1`
    if (!tRows[0]) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

    const vd = (tRows[0].venue_details as Record<string, unknown>) ?? {}
    const rawCats = (vd.categories as Array<{ name: string; genders?: string[] }>) ?? []

    // Expand category names the same way generateGroupBracket expects them
    const expandedCategories: string[] = []
    for (const cat of rawCats) {
      if (!cat.name?.trim()) continue
      if (!cat.genders?.length) {
        expandedCategories.push(cat.name)
      } else {
        for (const g of cat.genders) {
          const suffix = g === 'M' ? ' Masculino' : g === 'F' ? ' Femenino' : ' Mixto'
          expandedCategories.push(cat.name + suffix)
        }
      }
    }

    if (expandedCategories.length === 0) {
      return NextResponse.json({ error: 'No categories found in tournament config', vd }, { status: 400 })
    }

    // 2. Delete existing test registrations + all matches for this tournament
    await sql`DELETE FROM matches WHERE tournament_id = ${tournamentId}`
    await sql`DELETE FROM registrations WHERE tournament_id = ${tournamentId} AND form_data->>'seeded' = 'true'`

    // 3. Insert 12 pairs per category (48 players across 4 categories = 12 pairs × 4)
    const PAIRS_PER_CATEGORY = 12
    let playerSeed = 1
    const insertedRegs: { id: string; category: string }[] = []

    for (const catName of expandedCategories) {
      for (let p = 0; p < PAIRS_PER_CATEGORY; p++) {
        const p1Name = randomName(playerSeed++)
        const p2Name = randomName(playerSeed++)

        const rows = await sql`
          INSERT INTO registrations (
            tournament_id,
            player1_name,
            player2_name,
            status,
            form_data,
            created_at,
            updated_at
          ) VALUES (
            ${tournamentId},
            ${p1Name},
            ${p2Name},
            'confirmed',
            ${JSON.stringify({ category: catName, seeded: 'true', name: p1Name, partner_name: p2Name })}::jsonb,
            NOW(),
            NOW()
          )
          RETURNING id
        `
        insertedRegs.push({ id: rows[0].id as string, category: catName })
      }
    }

    // 4. Generate group bracket
    const result = await generateGroupBracket(tournamentId)
    if ('error' in result) {
      return NextResponse.json({ error: result.error, insertedRegs }, { status: 500 })
    }

    // 5. Count generated matches
    const matchCount = await sql`SELECT count(*)::int AS n FROM matches WHERE tournament_id = ${tournamentId}`

    return NextResponse.json({
      ok: true,
      categories: expandedCategories,
      pairsInserted: insertedRegs.length,
      matchesGenerated: matchCount[0]?.n ?? 0,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

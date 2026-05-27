'use server'

import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth'
import { getSystemPrompt } from '@/lib/prompts'
import { z } from 'zod'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const callAISchema = z.object({
  message: z.string().min(1).max(5000),
  promptName: z.string().default('main'),
})

export async function callAI(input: unknown) {
  const session = await auth.getSession()
  if (!session?.data) return { error: 'No autorizado' }

  const parsed = callAISchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Datos inválidos', details: parsed.error.flatten() }
  }

  try {
    const systemPrompt = await getSystemPrompt(parsed.data.promptName)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: parsed.data.message }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return { data: text }
  } catch {
    return { error: 'Ha ocurrido un error. Por favor, inténtalo de nuevo.' }
  }
}

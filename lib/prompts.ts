import { sql } from '@/lib/db'

/**
 * Load a system prompt from the database.
 * Prompts are stored in the `ai_prompts` table so they can be edited
 * without redeploying the app.
 */
export async function getSystemPrompt(name: string): Promise<string> {
  const result = await sql`
    SELECT content FROM ai_prompts WHERE name = ${name} LIMIT 1
  `
  if (!result[0]) {
    throw new Error(`Prompt '${name}' not found in database`)
  }
  return result[0].content
}

import { z } from 'zod'

export const createTournamentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  venue_name: z.string().min(1),
  venue_address: z.string().min(1),
  venue_details: z.record(z.string(), z.unknown()).optional(),
  category: z.string().min(1),
  format: z.enum(['elimination', 'round_robin', 'groups_elimination', 'american']),
  registration_type: z.enum(['pair', 'individual']),
  max_players: z.number().int().min(2).max(256),
  price_info: z.string().optional(),
  cancel_deadline: z.string().datetime().optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime().optional(),
})

export const updateTournamentSchema = createTournamentSchema.partial()

export const registerSchema = z.object({
  tournament_id: z.string().uuid(),
  player2_id: z.string().optional(),
  player2_name: z.string().optional(),
  registration_type: z.enum(['pair', 'individual']).optional(),
  form_data: z.record(z.string(), z.string()).optional(),
})

export const submitScoreSchema = z.object({
  match_id: z.string().uuid(),
  score: z.array(z.object({ vosotros: z.number().int().min(0), rival: z.number().int().min(0) })).min(1).max(5),
})

export const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
  category: z.string().optional(),
})

import { z } from 'zod'

export const aiRequestSchema = z.object({
  message: z.string().min(1, 'El mensaje no puede estar vacío').max(2000),
  promptName: z.string().default('main'),
})

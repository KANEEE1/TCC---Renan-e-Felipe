import { z } from "zod";

export const createTurmaSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

export type CreateTurmaInput = z.infer<typeof createTurmaSchema>;

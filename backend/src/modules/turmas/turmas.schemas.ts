import { z } from "zod";

export const createTurmaSchema = z.object({
  nome: z.string().min(1),
  anoLetivo: z.number().int().min(2000)
});

export type CreateTurmaInput = z.infer<typeof createTurmaSchema>;

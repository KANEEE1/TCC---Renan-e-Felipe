import { z } from "zod";

export const createTurmaSchema = z.object({
  nome: z.string().min(1),
  anoLetivo: z.number().int().min(2000),
  turno: z.string().min(1).optional(),
  sala: z.string().min(1).optional(),
  coordenador: z.string().min(1).optional(),
  capacidade: z.number().int().min(1).optional()
});

export const updateTurmaSchema = createTurmaSchema.partial();

export type CreateTurmaInput = z.infer<typeof createTurmaSchema>;
export type UpdateTurmaInput = z.infer<typeof updateTurmaSchema>;
